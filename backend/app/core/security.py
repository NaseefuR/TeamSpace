from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()
ALGORITHM = "HS256"


def hash_password(value: str) -> str:
    return password_hash.hash(value)


def verify_password(value: str, hashed: str) -> bool:
    return password_hash.verify(value, hashed)


def make_token(subject: str, kind: str, ttl: timedelta) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": subject, "kind": kind, "iat": now, "exp": now + ttl},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
