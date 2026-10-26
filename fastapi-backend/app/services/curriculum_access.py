from sqlalchemy import select

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.models.tables import (
    ClassMembership,
    Classroom,
    ClassStatus,
    MembershipRole,
    MembershipStatus,
    LabProgress,
    UserRole,
)
from app.services.course_configuration import configuration, preview_curriculum
from app.services.permissions import ClassAccess, legacy_restricted, require_class_member


async def class_lesson(db, user, class_id, lesson_id):
    access = await require_class_member()(class_id=class_id, user=user, db=db)
    config = await configuration(db, access, student_view=True, apply_access=False)
    from app.services.learning_progress import ensure_available

    await ensure_available(db, access, config, lesson_id)
    lesson = next(
        (item for lab in config["labs"] for item in lab["lessons"] if item["id"] == lesson_id), None
    )
    if lesson is None:
        raise LMSError(
            403, "LESSON_DISABLED", "Bài học không được bật trong chương trình hiện tại của lớp."
        )
    return {
        **lesson,
        "lab_id": next(
            lab["id"]
            for lab in config["labs"]
            if any(item["id"] == lesson_id for item in lab["lessons"])
        ),
    }


async def source_access(db, user, class_id, lesson_id):
    if class_id is not None:
        return await class_lesson(db, user, class_id, lesson_id)
    config = await preview_curriculum(db)
    lesson = next(
        (item for lab in config["labs"] for item in lab["lessons"] if item["id"] == lesson_id), None
    )
    if lesson is None:
        raise LMSError(
            403, "MEMBERSHIP_REQUIRED", "Bài này yêu cầu tham gia lớp có quyền truy cập."
        )
    return lesson


async def lab_entry(db, user, lab_id, lesson_id=None):
    """Where an old /labN?lesson=... link should go for this user (plan 10.6)."""
    if not get_settings().lms_class_mode:
        return {"target": "legacy"}
    rows = (
        await db.execute(
            select(Classroom, ClassMembership)
            .join(ClassMembership, ClassMembership.class_id == Classroom.id)
            .where(
                ClassMembership.user_id == user.id,
                ClassMembership.role == MembershipRole.student,
                ClassMembership.status == MembershipStatus.active,
                Classroom.status == ClassStatus.active,
                Classroom.lms_mode == "enabled",
            )
            .order_by(Classroom.id)
        )
    ).all()
    valid = []
    for classroom, membership in rows:
        try:
            config = await configuration(
                db, ClassAccess(classroom, user, membership), apply_access=False
            )
        except LMSError:
            continue  # No published curriculum yet: not a valid destination.
        lab = next((x for x in config["labs"] if x["id"] == lab_id and x["enabled"]), None)
        if lab is None:
            continue
        if lesson_id and not any(x["id"] == lesson_id and x["enabled"] for x in lab["lessons"]):
            continue
        valid.append({"id": classroom.id, "code": classroom.code, "name": classroom.name})
    if len(valid) == 1:
        return {"target": "class", "class_id": valid[0]["id"], "lesson_id": lesson_id}
    if valid:
        return {"target": "choose", "classes": valid, "lesson_id": lesson_id}
    # Students must not fall back to the unrestricted legacy renderer. Keep
    # the existing legacy path for staff accounts when no class destination
    # applies to them.
    if await legacy_restricted(db, user):
        return {"target": "experience"}
    if user.role == UserRole.user:
        completed = {
            row.lab_id
            for row in (
                await db.execute(select(LabProgress).where(LabProgress.user_id == user.id))
            ).scalars()
            if row.completed_at is not None
        }
        if lab_id > 0 and lab_id - 1 not in completed:
            return {
                "target": "locked",
                "lab_id": lab_id,
                "message": "Bạn cần hoàn thành Lab trước để mở khóa Lab này.",
            }
    # Authenticated users without an active LMS class retain access to the
    # existing lab experience. Class members are handled above and receive
    # the server-computed learning path instead.
    return {"target": "legacy"}
