from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

CAPTCHA_VERIFY_URLS = {
    "turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    "recaptcha": "https://www.google.com/recaptcha/api/siteverify",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://app:app@localhost:5433/app"
    frontend_url: str = "http://localhost:5173"

    jwt_secret: str = "change-me-in-env-please-at-least-32-bytes"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    admin_email: str = "admin@example.com"
    admin_password: str = "Admin123!"

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = False
    mail_from: str = "Secure Lab <no-reply@secure-lab.local>"

    activation_token_expire_minutes: int = 60
    password_reset_token_expire_minutes: int = 30

    mfa_code_expire_minutes: int = 5
    mfa_max_attempts: int = 5

    captcha_enabled: bool = True
    captcha_provider: Literal["image", "turnstile", "recaptcha"] = "image"
    captcha_length: int = 5
    captcha_expire_minutes: int = 5
    captcha_site_key: str = ""
    captcha_secret_key: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    google_discovery_url: str = "https://accounts.google.com/.well-known/openid-configuration"

    max_failed_login_attempts: int = 5
    lockout_minutes: int = 15
    ip_max_failed_attempts: int = 20
    ip_window_minutes: int = 15


settings = Settings()
