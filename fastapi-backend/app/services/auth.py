import secrets
from datetime import datetime, timezone
from hashlib import sha256
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.redis import get_redis
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models.tables import AccountStatus, GoogleIdentity, RevokedToken, User, UserRole
from app.repository.user import UserRepository
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

_BLACKLIST_PREFIX = "auth:blacklist:"


# ── FastAPI Dependencies ────────────────────────────────────────────────────────


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Lấy user hiện tại từ JWT token. Trả về None nếu chưa đăng nhập hoặc token bị blacklist."""
    if not token:
        return None

    # Kiểm tra token có bị thu hồi chưa
    redis = get_redis()
    if redis:
        try:
            if await redis.exists(f"{_BLACKLIST_PREFIX}{token}"):
                return None
        except Exception:
            logger.warning("[Auth] Redis unavailable; checking PostgreSQL revocations.")

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        if await db.get(RevokedToken, sha256(token.encode()).hexdigest()):
            return None
        user_id = int(payload["sub"])
        result = await db.execute(
            select(User)
            .where(
                User.id == user_id, User.deleted_at.is_(None), User.status == AccountStatus.active
            )
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"[Auth] get_current_user error: {e}")
        return None


async def get_required_user(
    current_user: Optional[User] = Depends(get_current_user),
) -> User:
    """Dependency đảm bảo user đã đăng nhập. Trả 401 nếu chưa."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


# ── AuthService ─────────────────────────────────────────────────────────────────


class AuthService:
    """Service xử lý toàn bộ nghiệp vụ xác thực (đăng ký, đăng nhập, đăng xuất, lấy thông tin)."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self.user_repo = UserRepository(db_session)

    async def register_user(self, request: RegisterRequest) -> AuthTokenResponse:
        """Đăng ký tài khoản mới, trả về JWT token ngay sau khi tạo thành công."""
        email_clean = request.email.strip().lower()

        if await self.user_repo.check_email_exists(email_clean):
            logger.warning(
                f"[AuthService] ❌ Attempt to register with existing email: {email_clean}"
            )
            raise ValueError("Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.")

        full_name_val = (
            request.full_name.strip()
            if request.full_name and request.full_name.strip()
            else email_clean.split("@")[0]
        )

        new_user = User(
            email=email_clean,
            password_hash=await run_in_threadpool(hash_password, request.password),
            full_name=full_name_val,
            role="user",
        )

        try:
            created_user = await self.user_repo.create(new_user)
            await self.db_session.commit()
        except IntegrityError as exc:
            await self.db_session.rollback()
            raise ValueError("Email này đã được sử dụng. Vui lòng dùng email khác.") from exc
        await self.db_session.refresh(created_user)

        logger.success(
            f"[AuthService] ✅ New user registered: {created_user.email} (ID: {created_user.id})"
        )

        token = create_access_token(
            {
                "sub": str(created_user.id),
                "email": created_user.email,
                "role": created_user.role,
            }
        )

        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=created_user.id,
                email=created_user.email,
                full_name=created_user.full_name,
                role=created_user.role,
                created_at=created_user.created_at.isoformat() if created_user.created_at else None,
            ),
        )

    async def register_first_admin(self, request: RegisterRequest) -> AuthTokenResponse:
        """Create the bootstrap administrator only when no administrator exists."""
        admin_count = await self.db_session.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.admin,
                User.deleted_at.is_(None),
            )
        )
        if admin_count:
            raise ValueError("Tài khoản quản trị đầu tiên đã được khởi tạo.")

        email_clean = request.email.strip().lower()
        if await self.user_repo.check_email_exists(email_clean):
            raise ValueError("Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.")

        full_name = (
            request.full_name.strip()
            if request.full_name and request.full_name.strip()
            else email_clean.split("@")[0]
        )
        new_admin = User(
            email=email_clean,
            password_hash=await run_in_threadpool(hash_password, request.password),
            full_name=full_name,
            role=UserRole.admin,
        )
        try:
            created_admin = await self.user_repo.create(new_admin)
            await self.db_session.commit()
        except IntegrityError as exc:
            await self.db_session.rollback()
            raise ValueError("Email này đã được sử dụng. Vui lòng dùng email khác.") from exc
        await self.db_session.refresh(created_admin)

        token = create_access_token(
            {
                "sub": str(created_admin.id),
                "email": created_admin.email,
                "role": created_admin.role,
            }
        )
        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=created_admin.id,
                email=created_admin.email,
                full_name=created_admin.full_name,
                role=created_admin.role,
                created_at=(
                    created_admin.created_at.isoformat()
                    if created_admin.created_at
                    else None
                ),
            ),
        )

    async def login_user(self, request: LoginRequest, *, require_role: UserRole | None = None) -> AuthTokenResponse:
        """Xác thực email + password, trả về JWT token nếu hợp lệ."""
        email_clean = request.email.strip().lower()

        user = await self.user_repo.get_by_email(email_clean)
        if not user or not await run_in_threadpool(
            verify_password, request.password, user.password_hash
        ):
            raise ValueError("Email hoặc mật khẩu không chính xác.")

        if user.status != AccountStatus.active:
            raise ValueError("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.")

        if require_role is not None and user.role != require_role:
            raise ValueError(f"Tài khoản này không có quyền truy cập {require_role.value}.")

        if require_role is None and user.role == UserRole.admin:
            raise ValueError("Tài khoản quản trị chỉ được đăng nhập từ trang quản trị.")

        logger.info(f"[AuthService] 🔑 User logged in: {user.email} ({user.role.value})")

        token = create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role,
            }
        )

        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                created_at=user.created_at.isoformat() if user.created_at else None,
            ),
        )

    async def login_google(self, claims: dict) -> AuthTokenResponse:
        # Google sub is stable, unlike the email address.
        identity = await self.db_session.get(GoogleIdentity, claims["sub"])
        if identity:
            user = await self.db_session.get(User, identity.user_id)
            if not user or user.deleted_at is not None:
                raise ValueError("Tài khoản này không còn hoạt động.")
        else:
            email = claims["email"].strip().lower()
            user = await self.user_repo.get_by_email(email)
            if user and user.status != AccountStatus.active:
                raise ValueError("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.")
            # Only link by email when Google is authoritative for that address.
            if user and not (email.endswith("@gmail.com") or claims.get("hd")):
                raise ValueError("Email đã có tài khoản. Vui lòng đăng nhập bằng mật khẩu.")
            try:
                if not user:
                    user = await self.user_repo.create(
                        User(
                            email=email,
                            password_hash=await run_in_threadpool(
                                hash_password, secrets.token_urlsafe(32)
                            ),
                            full_name=claims.get("name") or email.split("@")[0],
                            role="user",
                        )
                    )
                self.db_session.add(GoogleIdentity(subject=claims["sub"], user_id=user.id))
                await self.db_session.commit()
                await self.db_session.refresh(user)
            except IntegrityError as exc:
                await self.db_session.rollback()
                raise ValueError(
                    "Tài khoản đã tồn tại hoặc vừa được tạo. Vui lòng thử đăng nhập lại."
                ) from exc
        if user.status != AccountStatus.active:
            raise ValueError("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.")
        return AuthTokenResponse(
            access_token=create_access_token(
                {"sub": str(user.id), "email": user.email, "role": user.role}
            ),
            user=await self.get_me(user),
        )

    async def logout_user(self, token: str) -> None:
        """Lưu thu hồi token vào PostgreSQL và cache trên Redis nếu khả dụng."""
        payload = decode_access_token(token)
        if not payload:
            return  # Token không hợp lệ, bỏ qua

        # Tính TTL còn lại (giây) để Redis tự xóa đúng lúc token hết hạn
        exp = payload.get("exp")
        ttl = int(exp - datetime.now(timezone.utc).timestamp()) if exp else 0

        if ttl <= 0:
            return  # Token đã hết hạn tự nhiên, không cần blacklist

        # PostgreSQL persists revocations even when Redis is offline or restarted.
        token_hash = sha256(token.encode()).hexdigest()
        await self.db_session.execute(
            delete(RevokedToken).where(RevokedToken.expires_at <= datetime.now(timezone.utc))
        )
        if not await self.db_session.get(RevokedToken, token_hash):
            self.db_session.add(
                RevokedToken(
                    token_hash=token_hash,
                    expires_at=datetime.fromtimestamp(exp, timezone.utc),
                )
            )
        try:
            await self.db_session.commit()
        except IntegrityError:
            await self.db_session.rollback()
            if not await self.db_session.get(RevokedToken, token_hash):
                raise

        redis = get_redis()
        if redis:
            try:
                await redis.setex(f"{_BLACKLIST_PREFIX}{token}", ttl, "revoked")
            except Exception:
                logger.warning("[AuthService] Redis unavailable; token revoked in PostgreSQL.")
        logger.info(f"[AuthService] Token revoked (TTL={ttl}s)")

    async def change_password(self, current_user: User, request: ChangePasswordRequest) -> None:
        """Đổi mật khẩu, yêu cầu xác nhận đúng mật khẩu hiện tại."""
        if not await run_in_threadpool(
            verify_password, request.current_password, current_user.password_hash
        ):
            raise ValueError("Mật khẩu hiện tại không chính xác.")

        current_user.password_hash = await run_in_threadpool(hash_password, request.new_password)
        await self.db_session.commit()
        logger.info(f"[AuthService] 🔒 Password changed: user_id={current_user.id}")

    async def get_me(self, current_user: User) -> UserResponse:
        """Trả về thông tin tài khoản đang đăng nhập."""
        return UserResponse(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role,
            created_at=current_user.created_at.isoformat() if current_user.created_at else None,
        )
