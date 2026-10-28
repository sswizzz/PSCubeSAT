"""Class/account transactions. Membership writes serialize on the class row."""

from datetime import datetime, timezone

from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.core.lms_errors import LMSError
from app.models.tables import (
    AccountStatus,
    AuditLog,
    ClassMembership,
    Classroom,
    ClassStatus,
    MembershipRole,
    MembershipStatus,
    User,
    UserRole,
)
from app.schemas.classes import ClassResponse, MemberResponse


def audit(db, actor, action, target, before, after):
    db.add(AuditLog(actor=actor, action=action, target=target, before=before, after=after))


def class_response(row, can_manage=False):
    return ClassResponse.model_validate(row).model_copy(update={"can_manage": can_manage})


def member_response(row, user):
    return MemberResponse(
        id=row.id,
        user_id=row.user_id,
        email=user.email,
        full_name=user.full_name,
        role=row.role,
        status=row.status,
        added_at=row.added_at,
        removed_at=row.removed_at,
    )


async def paginate(db, query, page, page_size):
    total = (
        await db.execute(select(func.count()).select_from(query.order_by(None).subquery()))
    ).scalar_one()
    rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).all()
    return rows, total


def search_filter(columns, search):
    # Treat SQL wildcard characters as literal user search text.
    escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return or_(*(column.ilike(f"%{escaped}%", escape="\\") for column in columns))


async def update_user(db, actor, user_id, changes):
    target = (
        await db.execute(
            select(User)
            .where(
                User.id == user_id,
                User.deleted_at.is_(None),
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if target is None:
        raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy tài khoản.")
    if target.id == actor.id:
        raise LMSError(403, "FORBIDDEN_ROLE", "Không thể tự thay đổi quyền hoặc trạng thái tài khoản.")
    requested_role = changes.get("role", target.role)
    requested_status = changes.get("status", target.status)
    if (
        target.role == UserRole.admin
        and (requested_role != UserRole.admin or requested_status == AccountStatus.locked)
    ):
        active_admins = await db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.admin,
                User.status == AccountStatus.active,
                User.deleted_at.is_(None),
            )
        )
        if active_admins <= 1:
            raise LMSError(
                409,
                "CONFIG_INVALID",
                "Không thể hạ quyền hoặc khóa quản trị viên cuối cùng.",
            )
    before = {"role": target.role, "status": target.status}
    for key, value in changes.items():
        setattr(target, key, value)
    after = {"role": target.role, "status": target.status}
    if before != after:
        target.updated_at = datetime.now(timezone.utc)
        audit(db, actor.id, "user.update", f"user:{target.id}", before, after)
    await db.commit()
    await db.refresh(target)
    return target


async def create_class(db, actor, request):
    teacher_id = request.teacher_id if actor.role == UserRole.admin else actor.id
    if actor.role != UserRole.admin and request.teacher_id not in (None, actor.id):
        raise LMSError(403, "FORBIDDEN_ROLE", "Bạn chỉ được tạo lớp do mình phụ trách.")
    teacher = (
        await db.execute(
            select(User).where(
                User.id == teacher_id,
                User.role == UserRole.teacher,
                User.status == AccountStatus.active,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if teacher is None:
        raise LMSError(422, "CONFIG_INVALID", "Chọn một tài khoản giảng viên đang hoạt động.")
    row = Classroom(**request.model_dump(exclude={"teacher_id"}), created_by=actor.id)
    db.add(row)
    try:
        await db.flush()
        db.add(
            ClassMembership(
                class_id=row.id,
                user_id=teacher.id,
                role=MembershipRole.teacher,
                added_by=actor.id,
            )
        )
        audit(
            db,
            actor.id,
            "class.create",
            f"class:{row.id}",
            None,
            {"code": row.code, "name": row.name, "status": row.status, "teacher_id": teacher.id},
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise LMSError(
            409, "VERSION_CONFLICT", "Mã lớp đã tồn tại. Vui lòng chọn mã khác."
        ) from exc
    await db.refresh(row)
    return class_response(row, True)


async def update_class(db, access, changes):
    row = access.classroom
    if row.status == ClassStatus.active and changes.get("status") == ClassStatus.draft:
        raise LMSError(409, "CONFIG_INVALID", "Lớp đã mở không thể chuyển về bản nháp.")
    before = {key: getattr(row, key) for key in changes}
    for key, value in changes.items():
        setattr(row, key, value)
    after = {key: getattr(row, key) for key in changes}
    if before != after:
        audit(db, access.user.id, "class.update", f"class:{row.id}", before, after)
    await db.commit()
    await db.refresh(row)
    return class_response(row, True)


async def add_student(db, access, email):
    user = (
        await db.execute(
            select(User).where(
                func.lower(User.email) == email,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if user is None:
        raise LMSError(
            404, "CONFIG_INVALID", "Email chưa có tài khoản. Sinh viên cần đăng ký trước."
        )
    if user.status != AccountStatus.active:
        raise LMSError(409, "CONFIG_INVALID", "Tài khoản này đang bị khóa.")
    row = (
        await db.execute(
            select(ClassMembership).where(
                ClassMembership.class_id == access.classroom.id,
                ClassMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row and row.role != MembershipRole.student:
        raise LMSError(409, "CONFIG_INVALID", "Tài khoản đã là giảng viên của lớp.")
    if row and row.status == MembershipStatus.active:
        return member_response(row, user)
    before = {"status": row.status} if row else None
    if row is None:
        row = ClassMembership(
            class_id=access.classroom.id, user_id=user.id, role=MembershipRole.student
        )
        db.add(row)
    row.status = MembershipStatus.active
    row.added_by = access.user.id
    row.added_at = datetime.now(timezone.utc)
    row.removed_at = None
    await db.flush()
    audit(
        db,
        access.user.id,
        "member.restore" if before else "member.add",
        f"membership:{row.id}",
        before,
        {"status": row.status, "class_id": row.class_id, "user_id": user.id},
    )
    await db.commit()
    await db.refresh(row)
    return member_response(row, user)


async def remove_student(db, access, user_id):
    row = (
        await db.execute(
            select(ClassMembership).where(
                ClassMembership.class_id == access.classroom.id,
                ClassMembership.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row and row.role != MembershipRole.student:
        raise LMSError(
            403, "FORBIDDEN_ROLE", "Không thể xóa giảng viên bằng thao tác xóa sinh viên."
        )
    if row and row.status != MembershipStatus.removed:
        row.status = MembershipStatus.removed
        row.removed_at = datetime.now(timezone.utc)
        audit(
            db,
            access.user.id,
            "member.remove",
            f"membership:{row.id}",
            {"status": "active"},
            {"status": "removed"},
        )
        await db.commit()


async def set_class_mode(db, actor, class_id, request):
    row = (
        await db.execute(
            select(Classroom)
            .where(Classroom.id == class_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if row is None:
        raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy lớp học.")
    before = row.lms_mode
    if before != request.lms_mode:
        row.lms_mode = request.lms_mode
        audit(
            db,
            actor.id,
            "class.lms_mode",
            f"class:{row.id}",
            {"lms_mode": before},
            {"lms_mode": row.lms_mode, "reason": request.reason},
        )
        logger.bind(
            action="class_lms_mode_changed",
            class_id=row.id,
            status_from=before,
            status_to=row.lms_mode,
        ).info("Class LMS mode changed")
    await db.commit()
    await db.refresh(row)
    return class_response(row, True)
