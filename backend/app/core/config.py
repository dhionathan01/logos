from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="LOGOS_", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://logos:logos@localhost:5432/logos"

    db_connect_timeout_seconds: int = Field(default=5, ge=1)
    db_statement_timeout_ms: int = Field(default=5_000, ge=100)
    db_pool_size: int = Field(default=5, ge=1)
    db_retry_attempts: int = Field(default=3, ge=1)

    jwt_secret: SecretStr = SecretStr("dev-only-secret-change-me-in-production")
    jwt_expiration_minutes: int = Field(default=480, ge=5)
    ingestion_api_key: SecretStr = SecretStr("dev-ingestion-key")

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
