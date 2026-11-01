import re

MIN_PASSWORD_LENGTH = 8

PASSWORD_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"[a-z]"), "Password must contain a lowercase letter"),
    (re.compile(r"[A-Z]"), "Password must contain an uppercase letter"),
    (re.compile(r"\d"), "Password must contain a digit"),
    (re.compile(r"[^A-Za-z0-9]"), "Password must contain a special character"),
]


def password_policy_errors(password: str) -> list[str]:
    errors = []
    if len(password) < MIN_PASSWORD_LENGTH:
        errors.append(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    errors += [msg for pattern, msg in PASSWORD_RULES if not pattern.search(password)]
    return errors
