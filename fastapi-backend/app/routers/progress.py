"""
routers/progress.py
────────────────────
Tiến độ học tập:
  GET  /api/progress                          — Tiến độ tất cả lab của user hiện tại
  POST /api/progress/{lab_id}/video-watched    — Đánh dấu đã xem hết video
  POST /api/progress/{lab_id}/doc-viewed       — Đánh dấu đã mở tài liệu
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tables import User
from app.schemas.progress import LabProgressResponse
from app.services.auth import get_required_user
from app.services.permissions import require_legacy_allowed
from app.services.progress import ProgressService

router = APIRouter(
    prefix="/api/progress",
    tags=["progress"],
    dependencies=[Depends(get_required_user), Depends(require_legacy_allowed)],
)


@router.get("", response_model=list[LabProgressResponse])
async def list_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Tiến độ học của tất cả lab mà user hiện tại đã tương tác."""
    return await ProgressService(db).list_progress(current_user.id)


@router.post("/{lab_id}/video-watched", response_model=LabProgressResponse)
async def mark_video_watched(
    lab_id: Annotated[int, Path(ge=0, le=8)],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    return await ProgressService(db).mark_video_watched(current_user.id, lab_id)


@router.post("/{lab_id}/doc-viewed", response_model=LabProgressResponse)
async def mark_doc_viewed(
    lab_id: Annotated[int, Path(ge=0, le=8)],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    return await ProgressService(db).mark_doc_viewed(current_user.id, lab_id)


@router.post("/{lab_id}/lessons/{lesson_id}/start", response_model=LabProgressResponse)
async def start_lesson(
    lab_id: Annotated[int, Path(ge=0, le=8)],
    lesson_id: str = Path(min_length=1, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    return await ProgressService(db).start_lesson(current_user, lab_id, lesson_id)


@router.post("/{lab_id}/lessons/{lesson_id}/complete", response_model=LabProgressResponse)
async def complete_lesson(
    lab_id: Annotated[int, Path(ge=0, le=8)],
    lesson_id: str = Path(min_length=1, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    return await ProgressService(db).complete_lesson(current_user, lab_id, lesson_id)
