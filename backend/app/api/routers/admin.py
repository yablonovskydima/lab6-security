from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import AdminUser, DbSession
from app.models import LoginAttempt, LoginResult, User
from app.schemas.login_attempt import LoginAttemptOut, LoginAttemptSummaryOut
from app.schemas.user import AdminUserOut, RoleUpdateIn
from app.services.login_guard import reset_failures

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_or_404(db: DbSession, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _get_other_user(db: DbSession, user_id: int, admin: User, action: str) -> User:
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You cannot {action} yourself")
    return _get_or_404(db, user_id)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(_: AdminUser, db: DbSession):
    return db.scalars(select(User).order_by(User.id)).all()


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(user_id: int, _: AdminUser, db: DbSession):
    return _get_or_404(db, user_id)


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def set_role(user_id: int, data: RoleUpdateIn, admin: AdminUser, db: DbSession):
    user = _get_other_user(db, user_id, admin, "change the role of")
    user.role = data.role
    db.commit()
    return user


@router.post("/users/{user_id}/block", response_model=AdminUserOut)
def block_user(user_id: int, admin: AdminUser, db: DbSession):
    user = _get_other_user(db, user_id, admin, "block")
    user.is_active = False
    db.commit()
    return user


@router.post("/users/{user_id}/unblock", response_model=AdminUserOut)
def unblock_user(user_id: int, _: AdminUser, db: DbSession):
    user = _get_or_404(db, user_id)
    user.is_active = True
    reset_failures(user)
    db.commit()
    return user


@router.get("/login-attempts", response_model=list[LoginAttemptOut])
def list_login_attempts(
    _: AdminUser,
    db: DbSession,
    email: str | None = None,
    user_id: int | None = None,
    ip: str | None = None,
    result: LoginResult | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    q = select(LoginAttempt)
    if email:
        q = q.where(LoginAttempt.email.ilike(f"%{email}%"))
    if user_id is not None:
        q = q.where(LoginAttempt.user_id == user_id)
    if ip:
        q = q.where(LoginAttempt.ip_address == ip)
    if result is not None:
        q = q.where(LoginAttempt.result == result)
    q = q.order_by(LoginAttempt.created_at.desc(), LoginAttempt.id.desc()).limit(limit).offset(offset)
    return db.scalars(q).all()


@router.get("/login-attempts/summary", response_model=list[LoginAttemptSummaryOut])
def login_attempts_summary(_: AdminUser, db: DbSession):
    rows = db.execute(
        select(
            LoginAttempt.email,
            func.max(LoginAttempt.user_id).label("user_id"),
            func.count().label("total"),
            func.count()
            .filter(LoginAttempt.result.not_in([LoginResult.success, LoginResult.mfa_pending]))
            .label("failed"),
            func.max(LoginAttempt.created_at).label("last_attempt_at"),
        )
        .group_by(LoginAttempt.email)
        .order_by(func.max(LoginAttempt.created_at).desc())
    ).all()
    return [LoginAttemptSummaryOut.model_validate(r._mapping) for r in rows]
