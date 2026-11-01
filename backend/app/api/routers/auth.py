import math
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.api.deps import DbSession, get_token_payload
from app.core.config import settings
from app.core.password_policy import password_policy_errors
from app.core.security import create_access_token, hash_password, verify_password
from app.models import LoginResult, MfaPurpose, RevokedToken, TokenPurpose, User
from app.schemas.auth import (
    CaptchaConfigOut,
    CaptchaImageOut,
    EmailIn,
    LoginIn,
    MessageOut,
    MfaChallengeOut,
    MfaVerifyIn,
    PasswordCheckIn,
    PasswordResetConfirmIn,
    RegisterIn,
    TokenIn,
    TokenOut,
)
from app.schemas.user import UserOut
from app.services import login_guard, mfa
from app.services.captcha import create_image_challenge, verify_captcha
from app.services.email import (
    send_activation_email,
    send_mfa_code_email,
    send_password_reset_email,
)
from app.services.user_tokens import consume_token, issue_token

router = APIRouter(prefix="/auth", tags=["auth"])

_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _client(request: Request) -> tuple[str | None, str | None]:
    return (request.client.host if request.client else None), request.headers.get("user-agent")


def _send_activation(db: DbSession, user: User, background: BackgroundTasks) -> None:
    raw = issue_token(db, user, TokenPurpose.activation, settings.activation_token_expire_minutes)
    db.commit()
    link = f"{settings.frontend_url}/activate?token={raw}"
    background.add_task(send_activation_email, user.email, link)


def _issue_access_token(user: User) -> TokenOut:
    token, expires_in = create_access_token(user)
    return TokenOut(access_token=token, expires_in=expires_in)


@router.get("/captcha-config", response_model=CaptchaConfigOut)
def captcha_config():
    return CaptchaConfigOut(
        enabled=settings.captcha_enabled,
        provider=settings.captcha_provider,
        site_key=settings.captcha_site_key if settings.captcha_enabled else None,
    )


@router.get("/captcha", response_model=CaptchaImageOut)
def captcha_image(db: DbSession, response: Response):
    if not settings.captcha_enabled or settings.captcha_provider != "image":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image CAPTCHA is not enabled")
    response.headers["Cache-Control"] = "no-store"
    captcha_id, image = create_image_challenge(db)
    return CaptchaImageOut(captcha_id=captcha_id, image=image, expires_in=settings.captcha_expire_minutes * 60)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, request: Request, db: DbSession, background: BackgroundTasks):
    ip, _ = _client(request)
    if not verify_captcha(db, data.captcha_token, data.captcha_answer, ip):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "CAPTCHA verification failed")
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "User with this email already exists")
    user = User(email=email, full_name=data.full_name, password_hash=hash_password(data.password))
    db.add(user)
    db.flush()
    _send_activation(db, user, background)
    return user


@router.post("/activate", response_model=MessageOut)
def activate(data: TokenIn, db: DbSession):
    user = consume_token(db, data.token, TokenPurpose.activation)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Activation link is invalid or has expired")
    user.is_verified = True
    db.commit()
    return MessageOut(detail="Account activated")


@router.post("/resend-activation", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def resend_activation(data: EmailIn, db: DbSession, background: BackgroundTasks):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is not None and not user.is_verified:
        _send_activation(db, user, background)
    return MessageOut(detail="If the account exists and is not activated, an email has been sent")


@router.post("/login", response_model=TokenOut | MfaChallengeOut)
def login(data: LoginIn, request: Request, db: DbSession, background: BackgroundTasks):
    email = data.email.lower()
    ip, ua = _client(request)

    def fail(result: LoginResult, code: int, detail: str, user: User | None = None):
        login_guard.record_attempt(db, email, result, ip, ua, user)
        db.commit()
        raise HTTPException(code, detail)

    if login_guard.ip_is_throttled(db, ip):
        fail(LoginResult.ip_throttled, status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts, try again later")

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(data.password, _DUMMY_HASH)
        fail(LoginResult.invalid_credentials, status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    if user.is_locked:
        minutes = math.ceil((user.locked_until - datetime.now(UTC)).total_seconds() / 60)
        fail(
            LoginResult.locked,
            status.HTTP_423_LOCKED,
            f"Account is temporarily locked, try again in {minutes} min",
            user,
        )

    if not verify_password(data.password, user.password_hash):
        login_guard.register_failure(user)
        if user.is_locked:
            fail(
                LoginResult.invalid_credentials,
                status.HTTP_423_LOCKED,
                f"Too many failed attempts, account locked for {settings.lockout_minutes} min",
                user,
            )
        fail(LoginResult.invalid_credentials, status.HTTP_401_UNAUTHORIZED, "Invalid email or password", user)

    if not user.is_active:
        fail(LoginResult.blocked, status.HTTP_403_FORBIDDEN, "Account is blocked", user)
    if not user.is_verified:
        fail(LoginResult.not_verified, status.HTTP_403_FORBIDDEN, "Account is not activated, check your email", user)

    login_guard.reset_failures(user)

    if user.mfa_enabled:
        raw, code = mfa.create_challenge(db, user, MfaPurpose.login)
        login_guard.record_attempt(db, email, LoginResult.mfa_pending, ip, ua, user)
        db.commit()
        background.add_task(send_mfa_code_email, user.email, code)
        return MfaChallengeOut(mfa_token=raw, expires_in=settings.mfa_code_expire_minutes * 60)

    login_guard.record_attempt(db, email, LoginResult.success, ip, ua, user)
    db.commit()
    return _issue_access_token(user)


@router.post("/login/mfa", response_model=TokenOut)
def login_mfa(data: MfaVerifyIn, request: Request, db: DbSession):
    ip, ua = _client(request)
    challenge = mfa.find_by_token(db, data.mfa_token, MfaPurpose.login)
    result = mfa.verify_code(challenge, data.code)
    user = challenge.user if challenge else None

    if result is not mfa.MfaCheck.ok:
        if user is not None:
            login_guard.record_attempt(db, user.email, LoginResult.mfa_failed, ip, ua, user)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, mfa.MFA_ERRORS[result])

    if not user.is_active:
        login_guard.record_attempt(db, user.email, LoginResult.blocked, ip, ua, user)
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is blocked")

    login_guard.record_attempt(db, user.email, LoginResult.success, ip, ua, user)
    db.commit()
    return _issue_access_token(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DbSession, payload: Annotated[dict, Depends(get_token_payload)]):
    db.add(RevokedToken(jti=payload["jti"], expires_at=datetime.fromtimestamp(payload["exp"], UTC)))
    db.commit()


@router.post("/password-reset/request", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def password_reset_request(data: EmailIn, db: DbSession, background: BackgroundTasks):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is not None and user.is_active:
        raw = issue_token(db, user, TokenPurpose.password_reset, settings.password_reset_token_expire_minutes)
        db.commit()
        link = f"{settings.frontend_url}/reset-password?token={raw}"
        background.add_task(send_password_reset_email, user.email, link)
    return MessageOut(detail="If the account exists, a password reset email has been sent")


@router.post("/password-reset/confirm", response_model=MessageOut)
def password_reset_confirm(data: PasswordResetConfirmIn, db: DbSession):
    user = consume_token(db, data.token, TokenPurpose.password_reset)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset link is invalid or has expired")
    user.password_hash = hash_password(data.new_password)
    user.password_changed_at = datetime.now(UTC)
    user.is_verified = True
    login_guard.reset_failures(user)
    db.commit()
    return MessageOut(detail="Password has been changed, you can log in now")


@router.post("/password-check")
def password_check(data: PasswordCheckIn):
    errors = password_policy_errors(data.password)
    return {"valid": not errors, "errors": errors}
