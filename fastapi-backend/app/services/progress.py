from datetime import datetime, timezone

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.lms_errors import LMSError
from app.models.tables import UserRole
from app.services.curriculum_seed import read_seed

from app.repository.progress import ProgressRepository
from app.schemas.progress import LabProgressResponse

# Lab không có bước biên dịch (chỉ video + tài liệu) — tiêu chí hoàn thành khác các lab còn lại
LAB_IDS_WITHOUT_COMPILER = {0}


def _to_response(p) -> LabProgressResponse:
    return LabProgressResponse(
        lab_id=p.lab_id,
        video_watched=p.video_watched,
        doc_viewed=p.doc_viewed,
        compiled_at=p.compiled_at.isoformat() if p.compiled_at else None,
        completed_at=p.completed_at.isoformat() if p.completed_at else None,
        lessons=p.lesson_progress or {},
    )


class ProgressService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProgressRepository(db)

    async def list_progress(self, user_id: int) -> list[LabProgressResponse]:
        rows = await self.repo.list_by_user(user_id)
        return [_to_response(r) for r in rows]

    async def mark_video_watched(self, user_id: int, lab_id: int) -> LabProgressResponse:
        progress = await self.repo.get_or_create(user_id, lab_id)
        progress.video_watched = True
        self._recompute_completion(progress)
        await self.db.commit()
        await self.db.refresh(progress)
        return _to_response(progress)

    async def mark_doc_viewed(self, user_id: int, lab_id: int) -> LabProgressResponse:
        progress = await self.repo.get_or_create(user_id, lab_id)
        progress.doc_viewed = True
        self._recompute_completion(progress)
        await self.db.commit()
        await self.db.refresh(progress)
        return _to_response(progress)

    async def start_lesson(self, user, lab_id: int, lesson_id: str) -> LabProgressResponse:
        progress = await self.repo.get_or_create(user.id, lab_id)
        lessons = dict(progress.lesson_progress or {})
        lessons.setdefault(lesson_id, {"started_at": datetime.now(timezone.utc).isoformat(), "completed": False})
        progress.lesson_progress = lessons
        await self.db.commit()
        await self.db.refresh(progress)
        return _to_response(progress)

    async def complete_lesson(self, user, lab_id: int, lesson_id: str) -> LabProgressResponse:
        progress = await self.repo.get_or_create(user.id, lab_id)
        lessons = dict(progress.lesson_progress or {})
        item = lessons.get(lesson_id)
        if item is None:
            raise LMSError(409, "LESSON_NOT_STARTED", "Hãy mở bài học trước khi hoàn thành.")
        lab = next((lab for lab in read_seed()["legacy"] if lab["id"] == lab_id), None)
        lesson_ids = [lesson["id"] for lesson in lab["lessons"]] if lab else []
        index = lesson_ids.index(lesson_id) if lesson_id in lesson_ids else -1
        if index > 0 and not all(lessons.get(previous, {}).get("completed") for previous in lesson_ids[:index]):
            raise LMSError(403, "PREREQUISITE_NOT_MET", "Bạn cần hoàn thành bài học trước để mở khóa bài này.")
        started = datetime.fromisoformat(item["started_at"])
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        if user.role not in (UserRole.teacher, UserRole.admin) and elapsed < 60:
            raise LMSError(409, "MINIMUM_LEARNING_TIME", "Bạn cần học bài này đủ 1 phút trước khi hoàn thành.", {"remaining_seconds": int(60 - elapsed)})
        item = {**item, "completed": True, "completed_at": datetime.now(timezone.utc).isoformat()}
        lessons[lesson_id] = item
        progress.lesson_progress = lessons
        if lesson_ids and all(lessons.get(lesson, {}).get("completed") for lesson in lesson_ids):
            progress.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(progress)
        return _to_response(progress)

    async def mark_compiled(self, user_id: int, lab_id: int) -> None:
        """Gọi khi biên dịch code của học viên thành công. Tự động tính là đã hoàn thành lab."""
        progress = await self.repo.get_or_create(user_id, lab_id)
        now = datetime.now(timezone.utc)
        if not progress.compiled_at:
            progress.compiled_at = now
        self._recompute_completion(progress)
        await self.db.commit()
        logger.info(
            f"[Progress] user_id={user_id} lab_id={lab_id} compiled_at={progress.compiled_at}"
        )

    def _recompute_completion(self, progress) -> None:
        if progress.completed_at:
            return

        if progress.lab_id in LAB_IDS_WITHOUT_COMPILER:
            done = progress.video_watched and progress.doc_viewed
        else:
            done = False  # A build is evidence of compilation, never lesson/lab completion.

        if done:
            progress.completed_at = datetime.now(timezone.utc)
