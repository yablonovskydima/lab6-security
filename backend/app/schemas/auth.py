from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field

from app.core.password_policy import password_policy_errors


def _check_password_policy(v: str) -> str:
    errors = password_policy_errors(v)
    if errors:
        raise ValueError("; ".join(errors))
    return v


StrongPassword = Annotated[str, Field(max_length=128), AfterValidator(_check_password_policy)]
MfaCode = Annotated[str, Field(pattern=r"^\d{6}$")]


class RegisterIn(BaseModel):
    email: EmailStr
    password: StrongPassword
    full_name: str | None = Field(default=None, max_length=255)
    captcha_token: str = Field(default="", max_length=4096)
    captcha_answer: str = Field(default="", max_length=32)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PasswordCheckIn(BaseModel):
    password: str = Field(max_length=128)


class TokenIn(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class EmailIn(BaseModel):
    email: EmailStr


class MfaVerifyIn(BaseModel):
    mfa_token: str = Field(min_length=1, max_length=128)
    code: MfaCode


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=1, max_length=128)
    new_password: StrongPassword


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MfaChallengeOut(BaseModel):
    mfa_required: Literal[True] = True
    mfa_token: str
    expires_in: int
    detail: str = "Verification code sent to your email"


class CaptchaConfigOut(BaseModel):
    enabled: bool
    provider: str
    site_key: str | None


class CaptchaImageOut(BaseModel):
    captcha_id: str
    image: str
    expires_in: int


class MessageOut(BaseModel):
    detail: str
