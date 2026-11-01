from datetime import datetime

from pydantic import BaseModel

from app.models import LoginMethod, LoginResult
from app.schemas.common import ORM


class LoginAttemptOut(ORM):
    id: int
    user_id: int | None
    email: str
    ip_address: str | None
    user_agent: str | None
    method: LoginMethod
    result: LoginResult
    success: bool
    created_at: datetime


class LoginAttemptSummaryOut(BaseModel):
    email: str
    user_id: int | None
    total: int
    failed: int
    last_attempt_at: datetime
