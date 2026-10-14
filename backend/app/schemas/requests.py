import base64
import re
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator


def _validated_push_endpoint(value: str) -> str:
    parsed = urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    trusted_hosts = (
        "fcm.googleapis.com",
        "push.services.mozilla.com",
        "web.push.apple.com",
        "wns.windows.com",
        "notify.windows.com",
    )
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("Endpoint must use the HTTPS scheme on the standard port") from error
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username
        or parsed.password
        or port not in {None, 443}
        or not any(host == suffix or host.endswith(f".{suffix}") for suffix in trusted_hosts)
    ):
        raise ValueError("Endpoint must be an HTTPS URL from a supported browser push service")
    return value


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str | None = None


class ProfilePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    designation: str | None = Field(default=None, max_length=160)
    timezone: str | None = Field(default=None, max_length=64)


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=256)
    auth: str = Field(min_length=1, max_length=256)

    @field_validator("p256dh")
    @classmethod
    def validate_p256dh(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value) or len(value) % 4 == 1:
            raise ValueError("Push public key must be base64url encoded")
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        if len(decoded) != 65 or decoded[0] != 4:
            raise ValueError("Push public key must be an uncompressed P-256 key")
        return value

    @field_validator("auth")
    @classmethod
    def validate_auth_secret(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value) or len(value) % 4 == 1:
            raise ValueError("Push authentication secret must be base64url encoded")
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        if len(decoded) != 16:
            raise ValueError("Push authentication secret must be 16 bytes")
        return value


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)
    keys: PushSubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def validate_push_endpoint(cls, value: str) -> str:
        return _validated_push_endpoint(value)


class PushSubscriptionDelete(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)

    @field_validator("endpoint")
    @classmethod
    def validate_push_endpoint(cls, value: str) -> str:
        return _validated_push_endpoint(value)
