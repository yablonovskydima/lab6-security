import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, BackgroundTasks, Cookie, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models import LoginMethod, LoginResult, MfaPurpose, User
from app.services import google_oauth, login_guard, mfa
from app.services.email import send_mfa_code_email

router = APIRouter(prefix="/auth/google", tags=["oauth"])

FLOW_COOKIE = "google_oauth_flow"
FLOW_COOKIE_PATH = "/auth/google"
FLOW_TTL = timedelta(minutes=10)
FLOW_AUDIENCE = "google-oauth-flow"


def _encode_flow(flow: dict[str, str]) -> str:
    payload = {**flow, "aud": FLOW_AUDIENCE, "exp": datetime.now(UTC) + FLOW_TTL}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_flow(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        return jwt.decode(raw, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience=FLOW_AUDIENCE)
    except jwt.PyJWTError:
        return None


def _frontend_redirect(**params) -> RedirectResponse:
    resp = RedirectResponse(f"{settings.frontend_url}/oauth/callback#{urlencode(params)}", status.HTTP_302_FOUND)
    resp.delete_cookie(FLOW_COOKIE, path=FLOW_COOKIE_PATH)
    return resp


def _find_or_create_user(db: DbSession, claims: dict) -> User:
    user = db.scalar(select(User).where(User.google_sub == claims["sub"]))
    if user is not None:
        return user
    email = claims["email"].lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            full_name=claims.get("name"),
            password_hash=hash_password(secrets.token_urlsafe(32)),
        )
        db.add(user)
    user.google_sub = claims["sub"]
    user.is_verified = True
    db.flush()
    return user


@router.get("/login")
def google_login():
    if not google_oauth.is_configured():
        return _frontend_redirect(error="Google login is not configured on the server")
    flow = google_oauth.new_flow()
    try:
        url = google_oauth.authorization_url(flow)
    except httpx.HTTPError:
        return _frontend_redirect(error="Could not reach Google, try again later")
    resp = RedirectResponse(url, status.HTTP_302_FOUND)
    resp.set_cookie(
        FLOW_COOKIE,
        _encode_flow(flow),
        max_age=int(FLOW_TTL.total_seconds()),
        path=FLOW_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=settings.google_redirect_uri.startswith("https://"),
    )
    return resp


@router.get("/callback")
def google_callback(
    request: Request,
    db: DbSession,
    background: BackgroundTasks,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    flow_cookie: Annotated[str | None, Cookie(alias=FLOW_COOKIE)] = None,
):
    if error:
        return _frontend_redirect(error=f"Google sign-in failed: {error}")

    flow = _decode_flow(flow_cookie)
    if flow is None or not code or not state or not secrets.compare_digest(state, flow["state"]):
        return _frontend_redirect(error="Invalid or expired sign-in session, try again")

    try:
        claims = google_oauth.verify_id_token(
            google_oauth.exchange_code(code, flow["code_verifier"]), flow["nonce"]
        )
    except google_oauth.GoogleAuthError as e:
        return _frontend_redirect(error=str(e))

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    user = _find_or_create_user(db, claims)

    def log(result: LoginResult) -> None:
        login_guard.record_attempt(db, user.email, result, ip, ua, user, LoginMethod.google)

    if not user.is_active:
        log(LoginResult.blocked)
        db.commit()
        return _frontend_redirect(error="Account is blocked")

    if user.mfa_enabled:
        raw, mfa_code = mfa.create_challenge(db, user, MfaPurpose.login)
        log(LoginResult.mfa_pending)
        db.commit()
        background.add_task(send_mfa_code_email, user.email, mfa_code)
        return _frontend_redirect(mfa_token=raw, expires_in=settings.mfa_code_expire_minutes * 60)

    log(LoginResult.success)
    db.commit()
    token, expires_in = create_access_token(user)
    return _frontend_redirect(access_token=token, token_type="bearer", expires_in=expires_in)
