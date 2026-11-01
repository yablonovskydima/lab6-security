import base64
import hashlib
import secrets
from functools import lru_cache
from urllib.parse import urlencode

import httpx
import jwt

from app.core.config import settings

GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")


class GoogleAuthError(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


@lru_cache
def _discovery() -> dict:
    resp = httpx.get(settings.google_discovery_url, timeout=5)
    resp.raise_for_status()
    return resp.json()


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(_discovery()["jwks_uri"])


def new_flow() -> dict[str, str]:
    return {
        "state": secrets.token_urlsafe(32),
        "nonce": secrets.token_urlsafe(32),
        "code_verifier": secrets.token_urlsafe(64),
    }


def _code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def authorization_url(flow: dict[str, str]) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": flow["state"],
        "nonce": flow["nonce"],
        "code_challenge": _code_challenge(flow["code_verifier"]),
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    return f"{_discovery()['authorization_endpoint']}?{urlencode(params)}"


def exchange_code(code: str, code_verifier: str) -> str:
    try:
        resp = httpx.post(
            _discovery()["token_endpoint"],
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            timeout=10,
        )
    except httpx.HTTPError as e:
        raise GoogleAuthError("Could not reach Google") from e
    if resp.status_code != 200:
        raise GoogleAuthError("Google rejected the authorization code")
    id_token = resp.json().get("id_token")
    if not id_token:
        raise GoogleAuthError("Google did not return an ID token")
    return id_token


def verify_id_token(id_token: str, nonce: str) -> dict:
    try:
        key = _jwks_client().get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            options={"require": ["iss", "sub", "aud", "exp", "iat"]},
        )
    except jwt.PyJWTError as e:
        raise GoogleAuthError("Invalid ID token") from e
    if claims["iss"] not in GOOGLE_ISSUERS:
        raise GoogleAuthError("Invalid ID token issuer")
    if not secrets.compare_digest(claims.get("nonce", ""), nonce):
        raise GoogleAuthError("Invalid ID token nonce")
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleAuthError("Google account email is not verified")
    return claims
