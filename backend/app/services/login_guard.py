from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import LoginAttempt, LoginMethod, LoginResult, User


def record_attempt(
    db: Session,
    email: str,
    result: LoginResult,
    ip: str | None,
    user_agent: str | None,
    user: User | None = None,
    method: LoginMethod = LoginMethod.password,
) -> None:
    db.add(
        LoginAttempt(
            user_id=user.id if user else None,
            email=email,
            ip_address=ip,
            user_agent=user_agent[:512] if user_agent else None,
            method=method,
            result=result,
        )
    )


def ip_is_throttled(db: Session, ip: str | None) -> bool:
    if ip is None:
        return False
    since = datetime.now(UTC) - timedelta(minutes=settings.ip_window_minutes)
    failed = db.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(
            LoginAttempt.ip_address == ip,
            LoginAttempt.result.in_([LoginResult.invalid_credentials, LoginResult.mfa_failed]),
            LoginAttempt.created_at >= since,
        )
    )
    return failed >= settings.ip_max_failed_attempts


def register_failure(user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= settings.max_failed_login_attempts:
        user.locked_until = datetime.now(UTC) + timedelta(minutes=settings.lockout_minutes)
        user.failed_login_attempts = 0


def reset_failures(user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
