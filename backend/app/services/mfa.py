import enum
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import MfaChallenge, MfaPurpose, User


class MfaCheck(enum.Enum):
    ok = "ok"
    invalid = "invalid"
    expired = "expired"
    exhausted = "exhausted"


def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _code_hash(token_hash: str, code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), f"{token_hash}:{code}".encode(), hashlib.sha256).hexdigest()


def create_challenge(
    db: Session, user: User, purpose: MfaPurpose, new_password_hash: str | None = None
) -> tuple[str, str]:
    db.execute(
        delete(MfaChallenge).where(
            MfaChallenge.user_id == user.id,
            MfaChallenge.purpose == purpose,
            MfaChallenge.used_at.is_(None),
        )
    )
    raw = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(10**6):06d}"
    token_hash = _token_hash(raw)
    db.add(
        MfaChallenge(
            user_id=user.id,
            purpose=purpose,
            token_hash=token_hash,
            code_hash=_code_hash(token_hash, code),
            new_password_hash=new_password_hash,
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.mfa_code_expire_minutes),
        )
    )
    return raw, code


def find_by_token(db: Session, raw: str, purpose: MfaPurpose) -> MfaChallenge | None:
    return db.scalar(
        select(MfaChallenge)
        .where(MfaChallenge.token_hash == _token_hash(raw), MfaChallenge.purpose == purpose)
        .with_for_update()
    )


def find_latest_for_user(db: Session, user: User, purpose: MfaPurpose) -> MfaChallenge | None:
    return db.scalar(
        select(MfaChallenge)
        .where(
            MfaChallenge.user_id == user.id,
            MfaChallenge.purpose == purpose,
            MfaChallenge.used_at.is_(None),
        )
        .order_by(MfaChallenge.id.desc())
        .with_for_update()
    )


def verify_code(challenge: MfaChallenge | None, code: str) -> MfaCheck:
    now = datetime.now(UTC)
    if challenge is None or challenge.used_at is not None:
        return MfaCheck.expired
    if challenge.expires_at < now:
        return MfaCheck.expired
    if challenge.attempts >= settings.mfa_max_attempts:
        return MfaCheck.exhausted
    if not hmac.compare_digest(challenge.code_hash, _code_hash(challenge.token_hash, code)):
        challenge.attempts += 1
        return MfaCheck.exhausted if challenge.attempts >= settings.mfa_max_attempts else MfaCheck.invalid
    challenge.used_at = now
    return MfaCheck.ok


MFA_ERRORS = {
    MfaCheck.invalid: "Invalid code",
    MfaCheck.expired: "Code is invalid or has expired",
    MfaCheck.exhausted: "Too many wrong codes, request a new one",
}
