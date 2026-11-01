import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, text: str, html: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException):
        logger.exception("Failed to send email to %s", to)


def send_activation_email(to: str, link: str) -> None:
    minutes = settings.activation_token_expire_minutes
    send_email(
        to,
        "Activate your account",
        f"Open this link to activate your account: {link}\n\nThe link expires in {minutes} minutes.",
        f"""<p>Thanks for signing up!</p>
<p><a href="{link}">Activate your account</a></p>
<p>The link expires in {minutes} minutes. If you did not sign up, ignore this email.</p>""",
    )


def send_mfa_code_email(to: str, code: str) -> None:
    minutes = settings.mfa_code_expire_minutes
    send_email(
        to,
        f"Your verification code: {code}",
        f"Your verification code is {code}\n\nIt expires in {minutes} minutes.",
        f"""<p>Your verification code:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{code}</p>
<p>It expires in {minutes} minutes. If you did not try to sign in, change your password.</p>""",
    )


def send_password_reset_email(to: str, link: str) -> None:
    minutes = settings.password_reset_token_expire_minutes
    send_email(
        to,
        "Reset your password",
        f"Open this link to set a new password: {link}\n\nThe link expires in {minutes} minutes.",
        f"""<p>We received a request to reset your password.</p>
<p><a href="{link}">Set a new password</a></p>
<p>The link expires in {minutes} minutes. If you did not request this, ignore this email.</p>""",
    )


def send_password_change_code_email(to: str, code: str) -> None:
    minutes = settings.mfa_code_expire_minutes
    send_email(
        to,
        f"Confirm password change: {code}",
        f"Your password change confirmation code is {code}\n\nIt expires in {minutes} minutes.",
        f"""<p>Someone asked to change the password for your account. Confirmation code:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{code}</p>
<p>It expires in {minutes} minutes. If it was not you, do not share this code and reset your password.</p>""",
    )


def send_password_changed_email(to: str) -> None:
    send_email(
        to,
        "Your password was changed",
        "The password for your account was just changed. If it was not you, reset your password now.",
        """<p>The password for your account was just changed.</p>
<p>If it was not you, reset your password now.</p>""",
    )
