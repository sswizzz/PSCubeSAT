from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.tables import AccountStatus, ClassStatus, MembershipRole, MembershipStatus, UserRole


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AdminUserPatch(InputModel):
    role: Literal["admin", "teacher", "user"] | None = None
    status: AccountStatus | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set or any(
            getattr(self, k) is None for k in self.model_fields_set
        ):
            raise ValueError("Chọn vai trò hoặc trạng thái hợp lệ cần thay đổi.")
        return self


class AdminUserUpdate(AdminUserPatch):
    user_id: int = Field(gt=0)

    @model_validator(mode="after")
    def require_update(self):
        if self.role is None and self.status is None:
            raise ValueError("Chọn vai trò hoặc trạng thái cần thay đổi.")
        return self


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str | None
    role: UserRole
    status: AccountStatus
    created_at: datetime | None


class ClassCreate(InputModel):
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    term: str | None = Field(default=None, max_length=100)
    status: Literal["draft", "active"] = "draft"
    teacher_id: int | None = Field(default=None, gt=0)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value):
        return value.upper()


class ClassPatch(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    term: str | None = Field(default=None, max_length=100)
    status: ClassStatus | None = None

    @model_validator(mode="after")
    def validate_change(self):
        if not self.model_fields_set or any(
            k in self.model_fields_set and getattr(self, k) is None for k in ("name", "status")
        ):
            raise ValueError("Thông tin cập nhật không hợp lệ.")
        return self


class ClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    description: str | None
    term: str | None
    status: ClassStatus
    lms_mode: Literal["enabled", "read_only", "off"] = "enabled"
    created_by: int
    created_at: datetime
    updated_at: datetime
    can_manage: bool = False


class ClassModeInput(InputModel):
    lms_mode: Literal["enabled", "read_only", "off"]
    reason: str = Field(min_length=5, max_length=1000)


class MemberAdd(InputModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class MemberRemove(InputModel):
    user_id: int = Field(gt=0)


class MemberResponse(BaseModel):
    id: int
    user_id: int
    email: str
    full_name: str | None
    role: MembershipRole
    status: MembershipStatus
    added_at: datetime
    removed_at: datetime | None


class UserPage(BaseModel):
    items: list[AdminUserResponse]
    total: int
    page: int
    page_size: int


class ClassPage(BaseModel):
    items: list[ClassResponse]
    total: int
    page: int
    page_size: int


class MemberPage(BaseModel):
    items: list[MemberResponse]
    total: int
    page: int
    page_size: int
