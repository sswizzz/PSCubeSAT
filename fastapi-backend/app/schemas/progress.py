from pydantic import BaseModel, Field


class LabProgressResponse(BaseModel):
    lab_id: int = Field(..., description="Id tĩnh của lab (khớp id bên frontend, 0-8)")
    video_watched: bool = Field(False, description="Đã xem hết video giới thiệu")
    doc_viewed: bool = Field(False, description="Đã mở tài liệu bài học")
    compiled_at: str | None = Field(None, description="Thời điểm biên dịch code thành công lần đầu")
    completed_at: str | None = Field(None, description="Thời điểm lab được đánh dấu hoàn thành")
    lessons: dict[str, dict] = Field(default_factory=dict)
