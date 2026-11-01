from datetime import UTC, datetime

from sqlalchemy import delete, select

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import MfaChallenge, RevokedToken, Role, User, UserToken


def init_db() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        now = datetime.now(UTC)
        db.execute(delete(RevokedToken).where(RevokedToken.expires_at < now))
        db.execute(delete(UserToken).where(UserToken.expires_at < now))
        db.execute(delete(MfaChallenge).where(MfaChallenge.expires_at < now))
        if not db.scalar(select(User).where(User.email == settings.admin_email)):
            db.add(
                User(
                    email=settings.admin_email,
                    full_name="Administrator",
                    password_hash=hash_password(settings.admin_password),
                    role=Role.admin,
                    is_verified=True,
                )
            )
        db.commit()
