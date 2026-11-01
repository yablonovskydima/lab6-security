import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import TokenPurpose, User, UserToken


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_token(db: Session, user: User, purpose: TokenPurpose, ttl_minutes: int) -> str:
    db.execute(
        delete(UserToken).where(
            UserToken.user_id == user.id,
            UserToken.purpose == purpose,
            UserToken.used_at.is_(None),
        )
    )
    raw = secrets.token_urlsafe(32)
    db.add(
        UserToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=_hash(raw),
            expires_at=datetime.now(UTC) + timedelta(minutes=ttl_minutes),
        )
    )
    return raw


def consume_token(db: Session, raw: str, purpose: TokenPurpose) -> User | None:
    token = db.scalar(
        select(UserToken)
        .where(UserToken.token_hash == _hash(raw), UserToken.purpose == purpose)
        .with_for_update()
    )
    now = datetime.now(UTC)
    if token is None or token.used_at is not None or token.expires_at < now:
        return None
    token.used_at = now
    return db.get(User, token.user_id)
