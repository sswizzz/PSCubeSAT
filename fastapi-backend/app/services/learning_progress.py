"""Database transactions around the pure learning rules."""

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.lms_errors import LMSError
from app.models.learning import (
    CompletionOverride,
    LessonProgress,
    PracticeSubmission,
    ProgressEvent,
)
from app.models.tables import ClassMembership, MembershipRole, MembershipStatus, User
from app.services.classes import audit
from app.services.learning_rules import (
    learning_path,
    lesson_version,
    merge_segments,
    satisfies,
    video_complete,
    watched_seconds,
)


async def raw_config(db, access):
    from app.services.course_configuration import configuration

    return await configuration(db, access, apply_access=False)


async def student_member(db, access, *, lock=False, membership_id=None):
    query = select(ClassMembership).where(
        ClassMembership.class_id == access.classroom.id,
        ClassMembership.role == MembershipRole.student,
        ClassMembership.status == MembershipStatus.active,
    )
    if membership_id is None:
        query = query.where(ClassMembership.user_id == access.user.id)
    else:
        query = query.where(ClassMembership.id == membership_id)
    if lock:
        query = query.with_for_update()
    member = (
        await db.execute(query.execution_options(populate_existing=True))
    ).scalar_one_or_none()
    if member is None:
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Cần tư cách sinh viên đang tham gia lớp.")
    return member


def serialize_progress(row):
    return {
        "lesson_id": row.lesson_id,
        "lesson_version": row.lesson_version,
        "status": row.status,
        "last_position": row.last_position,
        "watched_seconds": watched_seconds(row.watched_segments),
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
    }


async def member_paths(db, config, members):
    """Learning paths for many memberships with two queries in total."""
    ids = [member.id for member in members]
    if not ids:
        return {}
    rows = (
        await db.execute(
            select(LessonProgress)
            .where(
                LessonProgress.membership_id.in_(ids),
                LessonProgress.course_version_id == config["course_version_id"],
            )
            .order_by(LessonProgress.updated_at.desc())
        )
    ).scalars()
    progress = {member_id: [] for member_id in ids}
    for row in rows:
        progress[row.membership_id].append(row)
    unlocked = {member_id: set() for member_id in ids}
    for row in (
        await db.execute(
            select(CompletionOverride).where(
                CompletionOverride.membership_id.in_(ids),
                CompletionOverride.version == config["version"],
                CompletionOverride.action == "unlock",
            )
        )
    ).scalars():
        unlocked[row.membership_id].add(row.lab_id)
    paths = {}
    for member_id in ids:
        own = progress[member_id]
        path = learning_path(
            config,
            {row.lesson_id: row.status for row in own},
            unlocked=unlocked[member_id],
            last_lesson=own[0].lesson_id if own else None,
        )
        by_id = {row.lesson_id: serialize_progress(row) for row in own}
        for lab in path["labs"]:
            for lesson in lab["lessons"]:
                lesson.update(
                    by_id.get(
                        lesson["id"],
                        {"last_position": 0, "watched_seconds": 0, "completed_at": None},
                    )
                )
        paths[member_id] = path
    return paths


async def member_path(db, config, member):
    return (await member_paths(db, config, [member]))[member.id]


async def restricted_config(db, access, config):
    member = await student_member(db, access)
    path = await member_path(db, config, member)
    by_lab = {lab["id"]: lab for lab in path["labs"]}
    for lab in config["labs"]:
        state = by_lab.get(lab["id"])
        if not state:
            continue
        lab.update(
            {
                key: state[key]
                for key in ("access", "reason", "missing_prerequisites", "percent", "completed")
            }
        )
        states = {item["id"]: item for item in state["lessons"]}
        for lesson in lab["lessons"]:
            status = states[lesson["id"]]["status"]
            lesson["progress"] = states[lesson["id"]]
            if states[lesson["id"]]["access"] == "locked" and not satisfies(status):
                for key in ("content", "params", "completion_rule"):
                    lesson.pop(key, None)
    config["learning_path"] = path
    return config


async def ensure_available(db, access, config, lesson_id):
    lesson = next(
        (
            item
            for lab in config["labs"]
            if lab["enabled"]
            for item in lab["lessons"]
            if item["enabled"] and item["id"] == lesson_id
        ),
        None,
    )
    if lesson is None:
        raise LMSError(403, "LESSON_DISABLED", "Bài học không được bật trong lớp.")
    if not access.can_manage:
        member = await student_member(db, access)
        path = await member_path(db, config, member)
        lab = next(
            lab for lab in path["labs"] if any(item["id"] == lesson_id for item in lab["lessons"])
        )
        state = next(item["status"] for item in lab["lessons"] if item["id"] == lesson_id)
        lesson_state = next(item for item in lab["lessons"] if item["id"] == lesson_id)
        if lesson_state["access"] == "locked" and not satisfies(state):
            raise LMSError(
                403,
                "PREREQUISITE_NOT_MET",
                "Bạn cần hoàn thành bài học trước để mở khóa bài này.",
                {
                    "missing_labs": lab["missing_prerequisites"],
                    "lesson_id": lesson_id,
                    "reason": lesson_state["reason"] or lab["reason"],
                },
            )
    return lesson


async def progress_row(db, config, member, lesson_id):
    version = lesson_version(config, lesson_id)
    row = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.membership_id == member.id, LessonProgress.lesson_version == version
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = LessonProgress(
            membership_id=member.id,
            lesson_id=lesson_id,
            lesson_version=version,
            course_version_id=config["course_version_id"],
            status="not_started",
            last_position=0,
            watched_segments=[],
        )
        db.add(row)
        await db.flush()
    return row


async def replay(db, key, member, version, payload):
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    event = await db.get(ProgressEvent, key)
    if event and (
        event.membership_id != member.id
        or event.lesson_version != version
        or event.payload_hash != digest
    ):
        raise LMSError(409, "VERSION_CONFLICT", "Idempotency key đã được dùng cho nội dung khác.")
    return event, digest


async def commit_event(db, request, member, version, kind, digest, response):
    db.add(
        ProgressEvent(
            idempotency_key=request.idempotency_key,
            membership_id=member.id,
            lesson_version=version,
            kind=kind,
            payload_hash=digest,
            response=response,
        )
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise LMSError(
            409,
            "VERSION_CONFLICT",
            "Sự kiện đang được xử lý hoặc key đã được sử dụng. Hãy tải lại.",
        ) from exc
    return response


async def record_event(db, access, lesson_id, request):
    if access.can_manage:
        raise LMSError(
            403, "FORBIDDEN_ROLE", "Chế độ giảng viên/quản trị viên không ghi tiến độ học."
        )
    member = await student_member(db, access, lock=True)
    config = await raw_config(db, access)
    lesson = await ensure_available(db, access, config, lesson_id)
    version = lesson_version(config, lesson_id)
    old, digest = await replay(
        db,
        request.idempotency_key,
        member,
        version,
        request.model_dump(exclude={"idempotency_key"}),
    )
    if old:
        return old.response
    if (
        request.kind == "document_read"
        and lesson["type"] != "document"
        or request.kind.startswith("video_")
        and lesson["type"] != "video"
    ):
        raise LMSError(422, "CONFIG_INVALID", "Sự kiện không phù hợp loại bài học.")
    row = await progress_row(db, config, member, lesson_id)
    completed = False
    if request.kind == "document_read":
        completed = True
    elif request.kind == "video_confirmed":
        if not lesson["content"].get("confirmation_allowed", False):
            raise LMSError(
                403, "CONFIG_INVALID", "Giảng viên chưa bật xác nhận đã xem cho nguồn video này."
            )
        completed = True
    elif request.kind == "video_segment":
        content = lesson["content"]
        duration = content.get("duration_seconds", 0)
        if content.get("tracking_mode", "native") != "native":
            raise LMSError(422, "CONFIG_INVALID", "Nguồn này không nhận sự kiện đoạn xem.")
        try:
            row.watched_segments = merge_segments(
                row.watched_segments, request.start, request.end, duration
            )
            if request.position > duration:
                raise ValueError("Vị trí xem vượt quá thời lượng cấu hình.")
        except ValueError as exc:
            raise LMSError(422, "CONFIG_INVALID", str(exc)) from exc
        row.last_position = request.position
        completed = video_complete(
            row.watched_segments,
            duration,
            content.get("watch_ratio", lesson["completion_rule"].get("ratio", 0.9)),
        )
    if not satisfies(row.status):
        if completed:
            row.status = "completed"
            row.completed_at = datetime.now(timezone.utc)
        elif row.status != "pending_review":
            row.status = "in_progress"
    row.updated_at = datetime.now(timezone.utc)
    response = serialize_progress(row)
    return await commit_event(db, request, member, version, request.kind, digest, response)


def serialize_submission(row, membership_id, lesson_id, *, include_code=True):
    result = {
        "id": row.id,
        "membership_id": membership_id,
        "lesson_id": lesson_id,
        "revision": row.revision,
        "status": row.status,
        "feedback": row.feedback,
        "rubric": row.rubric_snapshot,
        "created_at": row.created_at.isoformat(),
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
    }
    if include_code:
        result["code"] = row.code
    return result


async def submit(db, access, lesson_id, request):
    if access.can_manage:
        raise LMSError(403, "FORBIDDEN_ROLE", "Chế độ giảng viên/quản trị viên không nộp bài học.")
    member = await student_member(db, access, lock=True)
    config = await raw_config(db, access)
    lesson = await ensure_available(db, access, config, lesson_id)
    if lesson["type"] != "practice" or not lesson["content"].get("rubric", "").strip():
        raise LMSError(
            422, "CONFIG_INVALID", "Bài thực hành cần rubric của giảng viên trước khi nộp."
        )
    version = lesson_version(config, lesson_id)
    old, digest = await replay(
        db, request.idempotency_key, member, version, {"kind": "submission", "code": request.code}
    )
    if old:
        return old.response
    progress = await progress_row(db, config, member, lesson_id)
    revision = (
        await db.execute(
            select(func.max(PracticeSubmission.revision)).where(
                PracticeSubmission.progress_id == progress.id
            )
        )
    ).scalar_one() or 0
    row = PracticeSubmission(
        progress_id=progress.id,
        revision=revision + 1,
        code=request.code,
        rubric_snapshot=lesson["content"]["rubric"],
        status="pending_review",
    )
    db.add(row)
    if not satisfies(progress.status):
        progress.status = "pending_review"
    progress.updated_at = datetime.now(timezone.utc)
    await db.flush()
    response = serialize_submission(row, member.id, lesson_id)
    return await commit_event(db, request, member, version, "submission", digest, response)


async def submission_query(db, access, *, lesson_id=None, submission_id=None):
    query = (
        select(PracticeSubmission, LessonProgress, ClassMembership)
        .join(LessonProgress, LessonProgress.id == PracticeSubmission.progress_id)
        .join(ClassMembership, ClassMembership.id == LessonProgress.membership_id)
        .where(ClassMembership.class_id == access.classroom.id)
    )
    if not access.can_manage:
        query = query.where(
            ClassMembership.user_id == access.user.id,
            ClassMembership.status == MembershipStatus.active,
        )
    if lesson_id:
        config = await raw_config(db, access)
        await ensure_available(db, access, config, lesson_id)
        query = query.where(LessonProgress.lesson_version == lesson_version(config, lesson_id))
    if submission_id:
        query = query.where(PracticeSubmission.id == submission_id)
    return list((await db.execute(query.order_by(PracticeSubmission.id.desc()))).all())


async def review(db, access, submission_id, request):
    rows = await submission_query(db, access, submission_id=submission_id)
    if not rows:
        raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy bài nộp trong lớp.")
    row, progress, member = rows[0]
    await db.refresh(member, with_for_update=True)
    newest = (
        await db.execute(
            select(func.max(PracticeSubmission.revision)).where(
                PracticeSubmission.progress_id == progress.id
            )
        )
    ).scalar_one()
    if newest != row.revision:
        raise LMSError(409, "VERSION_CONFLICT", "Sinh viên đã nộp phiên bản mới hơn.")
    if row.status != "pending_review":
        if row.status == request.verdict and row.feedback == request.feedback:
            return serialize_submission(row, member.id, progress.lesson_id)
        raise LMSError(409, "VERSION_CONFLICT", "Bài nộp này đã được chấm.")
    row.status = request.verdict
    row.feedback = request.feedback
    row.reviewed_by = access.user.id
    row.reviewed_at = datetime.now(timezone.utc)
    if not satisfies(progress.status):
        progress.status = "completed" if request.verdict == "approved" else "in_progress"
        progress.completed_at = row.reviewed_at if progress.status == "completed" else None
    audit(
        db,
        access.user.id,
        "submission.review",
        f"submission:{row.id}",
        {"status": "pending_review"},
        {"status": row.status, "feedback": row.feedback},
    )
    await db.commit()
    return serialize_submission(row, member.id, progress.lesson_id)


async def override(db, access, request):
    member = await student_member(db, access, lock=True, membership_id=request.membership_id)
    config = await raw_config(db, access)
    version = (
        lesson_version(config, request.lesson_id)
        if request.action == "waive"
        else f"config:{config['version']}/lab:{request.lab_id}"
    )
    payload = request.model_dump(exclude={"idempotency_key"})
    payload["actor"] = access.user.id
    old, digest = await replay(db, request.idempotency_key, member, version, payload)
    if old:
        return old.response
    if request.action == "waive":
        await ensure_available(db, access, config, request.lesson_id)
        row = await progress_row(db, config, member, request.lesson_id)
        if row.status != "completed":
            row.status = "waived"
            row.completed_at = datetime.now(timezone.utc)
    elif not any(lab["id"] == request.lab_id and lab["enabled"] for lab in config["labs"]):
        raise LMSError(422, "CONFIG_INVALID", "Lab không tồn tại hoặc đã tắt.")
    entry = CompletionOverride(
        membership_id=member.id,
        class_id=access.classroom.id,
        version=config["version"],
        action=request.action,
        lesson_version=version if request.action == "waive" else None,
        lab_id=request.lab_id,
        actor=access.user.id,
        reason=request.reason,
    )
    db.add(entry)
    await db.flush()
    response = {"id": entry.id, "action": request.action, "reason": request.reason}
    audit(db, access.user.id, "completion.override", f"membership:{member.id}", None, response)
    return await commit_event(db, request, member, version, "override", digest, response)


async def pending_submissions(db, access):
    newest = {}
    for row, progress, member in await submission_query(db, access):
        if progress.id not in newest:
            newest[progress.id] = (row, progress, member)
    return [
        serialize_submission(row, member.id, progress.lesson_id, include_code=False)
        for row, progress, member in newest.values()
        if row.status == "pending_review"
    ]


async def class_members(db, access):
    return (
        await db.execute(
            select(ClassMembership, User)
            .join(User, User.id == ClassMembership.user_id)
            .where(
                ClassMembership.class_id == access.classroom.id,
                ClassMembership.role == MembershipRole.student,
            )
            .order_by(ClassMembership.id)
        )
    ).all()


async def class_progress(db, access):
    config = await raw_config(db, access)
    if not access.can_manage:
        member = await student_member(db, access)
        return {"membership_id": member.id, **await member_path(db, config, member)}
    members = await class_members(db, access)
    paths = await member_paths(db, config, [member for member, _ in members])
    result = [
        {
            "membership_id": member.id,
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "membership_status": member.status,
            **paths[member.id],
        }
        for member, user in members
    ]
    return {"members": result, "pending_submissions": await pending_submissions(db, access)}
