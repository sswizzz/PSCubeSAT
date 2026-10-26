from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models import curriculum as curriculum_models  # noqa: F401
from app.models import learning as learning_models  # noqa: F401
from app.models import quiz as quiz_models  # noqa: F401


class UserRole(str, Enum):
    admin = "admin"
    teacher = "teacher"
    user = "user"


class AccountStatus(str, Enum):
    active = "active"
    locked = "locked"


class ClassStatus(str, Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class MembershipRole(str, Enum):
    teacher = "teacher"
    student = "student"


class MembershipStatus(str, Enum):
    active = "active"
    removed = "removed"


class DeviceStatus(str, Enum):
    offline = "offline"
    online = "online"
    sleep = "sleep"
    error = "error"


class AclPermission(str, Enum):
    allow = "allow"
    deny = "deny"


class AclAction(str, Enum):
    publish = "publish"
    subscribe = "subscribe"
    all = "all"


class CommandStatus(str, Enum):
    pending = "pending"
    sent = "sent"
    executed = "executed"
    failed = "failed"


class TimestampMixin:
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    __table_args__ = (Index("uq_users_email_normalized", func.lower(email), unique=True),)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"), nullable=False, server_default=text("'user'")
    )
    status: Mapped[AccountStatus] = mapped_column(
        SAEnum(AccountStatus, name="account_status"),
        nullable=False,
        server_default=text("'active'"),
    )

    devices: Mapped[list[Device]] = relationship(back_populates="user")


class Device(Base, TimestampMixin):
    __tablename__ = "devices"

    __table_args__ = (
        Index("idx_devices_uid", "device_uid"),
        Index("idx_devices_user", "user_id"),
        Index("idx_devices_deleted", "deleted_at", postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    device_uid: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    device_type: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'hardware'")
    )
    device_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[DeviceStatus] = mapped_column(
        SAEnum(DeviceStatus, name="device_status"), server_default=text("'offline'")
    )
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("TRUE"))
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    last_lat: Mapped[float | None] = mapped_column(nullable=True)
    last_lon: Mapped[float | None] = mapped_column(nullable=True)
    last_alt: Mapped[float | None] = mapped_column(nullable=True)
    last_position_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User | None] = relationship(back_populates="devices")
    mqtt_credentials: Mapped[MQTTCredential | None] = relationship(back_populates="device")
    mqtt_acl_rules: Mapped[list[MQTTACL]] = relationship(back_populates="device")
    telemetry_records: Mapped[list[Telemetry]] = relationship(back_populates="device")
    commands: Mapped[list[Command]] = relationship(back_populates="device")


class MQTTCredential(Base, TimestampMixin):
    __tablename__ = "mqtt_credentials"

    __table_args__ = (Index("idx_mqtt_username", "username"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), unique=True, nullable=True
    )
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("TRUE"))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    device: Mapped[Device | None] = relationship(back_populates="mqtt_credentials")


class MQTTACL(Base):
    __tablename__ = "mqtt_acl"

    __table_args__ = (Index("idx_acl_device", "device_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), nullable=True
    )
    permission: Mapped[AclPermission] = mapped_column(
        SAEnum(AclPermission, name="acl_permission"), nullable=False
    )
    action: Mapped[AclAction] = mapped_column(SAEnum(AclAction, name="acl_action"), nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False)

    device: Mapped[Device | None] = relationship(back_populates="mqtt_acl_rules")


class Telemetry(Base):
    __tablename__ = "telemetry"

    __table_args__ = (
        Index("idx_telemetry_device", "device_id"),
        Index("idx_telemetry_time", text("received_at DESC")),
        Index("idx_telemetry_payload", "payload", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), primary_key=True, nullable=False
    )

    device: Mapped[Device | None] = relationship(back_populates="telemetry_records")


class LabProgress(Base):
    __tablename__ = "lab_progress"

    __table_args__ = (
        UniqueConstraint("user_id", "lab_id", name="lab_progress_user_id_lab_id_key"),
        Index("idx_lab_progress_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lab_id: Mapped[int] = mapped_column(nullable=False)

    video_watched: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    doc_viewed: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    compiled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lesson_progress: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'"))

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Command(Base, TimestampMixin):
    __tablename__ = "commands"

    __table_args__ = (
        Index("idx_command_device", "device_id"),
        Index("idx_command_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("devices.id", ondelete="RESTRICT"), nullable=True
    )
    command: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[CommandStatus] = mapped_column(
        SAEnum(CommandStatus, name="command_status"), server_default=text("'pending'")
    )
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    device: Mapped[Device | None] = relationship(back_populates="commands")


class GoogleIdentity(Base):
    __tablename__ = "google_identities"
    subject: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )


class RevokedToken(Base):
    __tablename__ = "auth_revoked_tokens"
    token_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )


class Classroom(Base):
    __tablename__ = "classes"
    __table_args__ = (
        CheckConstraint("lms_mode IN ('enabled','read_only','off')", name="ck_class_lms_mode"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    term: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ClassStatus] = mapped_column(
        SAEnum(ClassStatus, name="class_status"), nullable=False, server_default=text("'draft'")
    )
    # Per-class pilot switch under the global LMS_CLASS_MODE gate (see Docs/DECISIONS.md).
    lms_mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'enabled'"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ClassMembership(Base):
    __tablename__ = "class_memberships"
    __table_args__ = (
        UniqueConstraint("class_id", "user_id", name="uq_class_membership"),
        Index("idx_membership_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    role: Mapped[MembershipRole] = mapped_column(SAEnum(MembershipRole, name="membership_role"))
    status: Mapped[MembershipStatus] = mapped_column(
        SAEnum(MembershipStatus, name="membership_status"), server_default=text("'active'")
    )
    added_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    actor: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[str] = mapped_column(Text)
    target: Mapped[str] = mapped_column(Text)
    before: Mapped[dict | None] = mapped_column(JSONB)
    after: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
