from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.api.deps import AnyUser, DbSession
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import MfaPurpose
from app.schemas.auth import MessageOut, TokenOut
from app.schemas.user import MfaCodeIn, PasswordChangeIn, PasswordConfirmIn, UserOut, UserUpdateIn
from app.services import mfa
from app.services.email import (
    send_mfa_code_email,
    send_password_change_code_email,
    send_password_changed_email,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: AnyUser):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdateIn, user: AnyUser, db: DbSession):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return user


@router.post("/me/password", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def request_password_change(data: PasswordChangeIn, user: AnyUser, db: DbSession, background: BackgroundTasks):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must differ from the current one")
    _, code = mfa.create_challenge(
        db, user, MfaPurpose.password_change, new_password_hash=hash_password(data.new_password)
    )
    db.commit()
    background.add_task(send_password_change_code_email, user.email, code)
    return MessageOut(
        detail=f"Confirmation code sent to your email, it expires in {settings.mfa_code_expire_minutes} min"
    )


@router.post("/me/password/confirm", response_model=TokenOut)
def confirm_password_change(data: MfaCodeIn, user: AnyUser, db: DbSession, background: BackgroundTasks):
    challenge = mfa.find_latest_for_user(db, user, MfaPurpose.password_change)
    result = mfa.verify_code(challenge, data.code)
    if result is not mfa.MfaCheck.ok:
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, mfa.MFA_ERRORS[result])
    user.password_hash = challenge.new_password_hash
    user.password_changed_at = datetime.now(UTC)
    db.commit()
    background.add_task(send_password_changed_email, user.email)
    token, expires_in = create_access_token(user)
    return TokenOut(access_token=token, expires_in=expires_in)


@router.post("/me/mfa/enable", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def mfa_enable(user: AnyUser, db: DbSession, background: BackgroundTasks):
    if user.mfa_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, "Two-factor authentication is already enabled")
    _, code = mfa.create_challenge(db, user, MfaPurpose.enable)
    db.commit()
    background.add_task(send_mfa_code_email, user.email, code)
    return MessageOut(
        detail=f"Verification code sent to your email, it expires in {settings.mfa_code_expire_minutes} min"
    )


@router.post("/me/mfa/confirm", response_model=UserOut)
def mfa_confirm(data: MfaCodeIn, user: AnyUser, db: DbSession):
    challenge = mfa.find_latest_for_user(db, user, MfaPurpose.enable)
    result = mfa.verify_code(challenge, data.code)
    if result is not mfa.MfaCheck.ok:
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, mfa.MFA_ERRORS[result])
    user.mfa_enabled = True
    db.commit()
    return user


@router.post("/me/mfa/disable", response_model=UserOut)
def mfa_disable(data: PasswordConfirmIn, user: AnyUser, db: DbSession):
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid password")
    user.mfa_enabled = False
    db.commit()
    return user
