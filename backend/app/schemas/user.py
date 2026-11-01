from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import Role
from app.schemas.auth import MfaCode, StrongPassword
from app.schemas.common import ORM


class UserOut(ORM):
    id: int
    email: EmailStr
    full_name: str | None
    role: Role
    is_active: bool
    is_verified: bool
    mfa_enabled: bool
    created_at: datetime


class AdminUserOut(UserOut):
    is_locked: bool
    locked_until: datetime | None
    failed_login_attempts: int


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)


class RoleUpdateIn(BaseModel):
    role: Role


class MfaCodeIn(BaseModel):
    code: MfaCode


class PasswordConfirmIn(BaseModel):
    password: str = Field(max_length=128)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: StrongPassword
