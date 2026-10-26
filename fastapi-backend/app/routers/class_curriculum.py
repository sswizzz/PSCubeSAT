from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.curriculum import CourseVersion
from app.models.tables import UserRole
from app.schemas.curriculum import PublishInput, SettingsInput
from app.services import course_configuration as service
from app.services.auth import get_required_user
from app.services.permissions import (
    ClassAccess,
    require_class_member,
    require_lms_enabled,
    require_system_role,
)

router = APIRouter(
    tags=["class-curriculum"],
    dependencies=[Depends(get_required_user), Depends(require_lms_enabled)],
)
public_router = APIRouter(tags=["class-curriculum"])
read_class = require_class_member()
write_class = require_class_member(roles=["teacher"], write=True)


@router.get("/api/curriculum/versions")
async def versions(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_system_role(UserRole.admin, UserRole.teacher)),
):
    rows = (
        await db.execute(
            select(CourseVersion)
            .where(CourseVersion.status == "published")
            .order_by(CourseVersion.created_at.desc())
        )
    ).scalars()
    return [{"id": row.id, "version": row.version, "course_id": row.course_id} for row in rows]


@router.get("/api/classes/{class_id}/curriculum")
async def curriculum(
    draft: bool = False,
    student_view: bool = False,
    course_version_id: str | None = None,
    access: ClassAccess = Depends(read_class),
    db: AsyncSession = Depends(get_db),
):
    return await service.configuration(
        db, access, draft=draft, student_view=student_view, version_id=course_version_id
    )


@router.put("/api/classes/{class_id}/settings")
async def settings(
    request: SettingsInput,
    access: ClassAccess = Depends(write_class),
    db: AsyncSession = Depends(get_db),
):
    return await service.save_settings(db, access, request)


@router.post("/api/classes/{class_id}/publish")
async def publish(
    request: PublishInput,
    dry_run: bool = Query(default=False),
    access: ClassAccess = Depends(write_class),
    db: AsyncSession = Depends(get_db),
):
    return await service.publish(db, access, request.expected_version, dry_run)


@public_router.get("/api/curriculum/preview")
async def preview(db: AsyncSession = Depends(get_db)):
    curriculum = await service.preview_curriculum(db)
    # Public visitors may preview the introductory lab only. Full curriculum
    # access requires an authenticated user and, for class learning, membership.
    curriculum["labs"] = [lab for lab in curriculum["labs"] if lab["id"] == 0]
    return curriculum
