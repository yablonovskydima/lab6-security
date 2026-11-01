import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LoginResult(str, enum.Enum):
    success = "success"
    invalid_credentials = "invalid_credentials"
    locked = "locked"
    blocked = "blocked"
    not_verified = "not_verified"
    ip_throttled = "ip_throttled"
    mfa_pending = "mfa_pending"
    mfa_failed = "mfa_failed"


class LoginMethod(str, enum.Enum):
    password = "password"
    google = "google"


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    method: Mapped[LoginMethod] = mapped_column(
        Enum(LoginMethod, name="login_method"), default=LoginMethod.password
    )
    result: Mapped[LoginResult] = mapped_column(Enum(LoginResult, name="login_result"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    @property
    def success(self) -> bool:
        return self.result == LoginResult.success
