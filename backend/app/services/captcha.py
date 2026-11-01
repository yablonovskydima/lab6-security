import base64
import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta

import httpx
from captcha.image import ImageCaptcha
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import CAPTCHA_VERIFY_URLS, settings
from app.models import CaptchaChallenge

logger = logging.getLogger(__name__)

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

_image = ImageCaptcha(width=220, height=80)


def _answer_hash(challenge_id: str, answer: str) -> str:
    message = f"{challenge_id}:{answer.strip().upper()}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()


def create_image_challenge(db: Session) -> tuple[str, str]:
    now = datetime.now(UTC)
    db.execute(delete(CaptchaChallenge).where(CaptchaChallenge.expires_at < now))
    text = "".join(secrets.choice(ALPHABET) for _ in range(settings.captcha_length))
    challenge_id = secrets.token_urlsafe(24)
    db.add(
        CaptchaChallenge(
            id=challenge_id,
            answer_hash=_answer_hash(challenge_id, text),
            expires_at=now + timedelta(minutes=settings.captcha_expire_minutes),
        )
    )
    db.commit()
    png = _image.generate(text).getvalue()
    return challenge_id, "data:image/png;base64," + base64.b64encode(png).decode()


def _verify_image(db: Session, challenge_id: str, answer: str) -> bool:
    if not challenge_id or not answer:
        return False
    challenge = db.get(CaptchaChallenge, challenge_id, with_for_update=True)
    if challenge is None:
        return False
    db.delete(challenge)
    db.commit()
    if challenge.expires_at < datetime.now(UTC):
        return False
    return hmac.compare_digest(challenge.answer_hash, _answer_hash(challenge_id, answer))


def _verify_widget(token: str, ip: str | None) -> bool:
    if not token:
        return False
    data = {"secret": settings.captcha_secret_key, "response": token}
    if ip:
        data["remoteip"] = ip
    try:
        resp = httpx.post(CAPTCHA_VERIFY_URLS[settings.captcha_provider], data=data, timeout=5)
        resp.raise_for_status()
        result = resp.json()
    except (httpx.HTTPError, ValueError):
        logger.exception("CAPTCHA verification request failed")
        return False
    if not result.get("success"):
        logger.warning("CAPTCHA rejected: %s", result.get("error-codes"))
        return False
    return True


def verify_captcha(db: Session, token: str, answer: str, ip: str | None) -> bool:
    if not settings.captcha_enabled:
        return True
    if settings.captcha_provider == "image":
        return _verify_image(db, token, answer)
    return _verify_widget(token, ip)
