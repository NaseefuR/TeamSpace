from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")
    app_name: str = "Teamwork API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./teamwork.db"
    brevo_api_key: str = ""
    brevo_sender_email: str = ""
    brevo_sender_name: str = "TeamSpace"
    frontend_base_url: str = "http://localhost:3000"
    jwt_secret: str = "development-only-change-this-secret"
    jwt_access_minutes: int = 20
    jwt_refresh_days: int = 30
    invite_only: bool = True
    demo_password: str = ""
    demo_lead_email: str = ""
    file_storage_path: str = "./uploads"
    max_upload_bytes: int = 52_428_800
    max_zip_files: int = 10_000
    max_zip_unpacked_bytes: int = 536_870_912
    cors_origins: str = "http://localhost:3000"
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@example.com"
    ai_base_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    ai_embedding_model: str = ""

    @model_validator(mode="after")
    def require_production_secret(self):
        if self.environment == "production" and (
            len(self.jwt_secret) < 32 or self.jwt_secret == "development-only-change-this-secret"
        ):
            raise ValueError(
                "JWT_SECRET must be a unique value of at least 32 characters in production"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
