from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tables import AccountStatus, User, UserRole
from app.schemas.auth import AuthTokenResponse, LoginRequest, RegisterRequest
from app.schemas.classes import (
    AdminUserPatch,
    AdminUserResponse,
    AdminUserUpdate,
    ClassModeInput,
    ClassResponse,
    UserPage,
)
from app.services.auth import AuthService
from app.services.classes import paginate, search_filter, set_class_mode, update_user
from app.services.permissions import require_lms_enabled, require_system_role
from app.services.reports import admin_dashboard

admin_user = require_system_role(UserRole.admin)
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
)


@router.post("/signup", response_model=AuthTokenResponse, status_code=201)
async def admin_signup(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).register_first_admin(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/login", response_model=AuthTokenResponse)
async def admin_login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).login_user(req, require_role=UserRole.admin)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/users", response_model=UserPage)
async def list_users(
    search: str = Query(default="", max_length=200),
    role: UserRole | None = None,
    status: AccountStatus | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: None = Depends(require_lms_enabled),
    _actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.deleted_at.is_(None))
    if search.strip():
        query = query.where(search_filter([User.email, User.full_name], search.strip()))
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.status == status)
    rows, total = await paginate(db, query.order_by(User.id), page, page_size)
    return {"items": [row[0] for row in rows], "total": total, "page": page, "page_size": page_size}


@router.patch("/users", response_model=AdminUserResponse)
async def patch_user(
    request: AdminUserUpdate,
    actor: User = Depends(admin_user),
    _: None = Depends(require_lms_enabled),
    db: AsyncSession = Depends(get_db),
):
    return await update_user(
        db, actor, request.user_id, request.model_dump(exclude_unset=True, exclude={"user_id"})
    )


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def patch_user_by_id(
    user_id: int,
    request: AdminUserPatch,
    actor: User = Depends(admin_user),
    _: None = Depends(require_lms_enabled),
    db: AsyncSession = Depends(get_db),
):
    return await update_user(db, actor, user_id, request.model_dump(exclude_unset=True))


@router.get("/dashboard")
async def dashboard(actor: User = Depends(admin_user), db: AsyncSession = Depends(get_db)):
    return await admin_dashboard(db, actor)


@router.patch("/classes/{class_id}/lms-mode", response_model=ClassResponse)
async def class_mode(
    class_id: int,
    request: ClassModeInput,
    actor: User = Depends(admin_user),
    _: None = Depends(require_lms_enabled),
    db: AsyncSession = Depends(get_db),
):
    return await set_class_mode(db, actor, class_id, request)
