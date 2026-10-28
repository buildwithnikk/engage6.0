"""Typed application settings.

Every value comes from the environment or has a safe default. Nothing here reads a
file at import time, and nothing here opens a database connection — the app must
import and start with no Supabase credentials present.
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Sahayak API"
    app_version: str = "0.1.0"
    environment: str = Field(default="development")

    # Comma-separated list, e.g. "http://localhost:3000,http://127.0.0.1:3000".
    # Wildcard origins are rejected when credentials are enabled (see the validator below).
    cors_allow_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000")
    cors_allow_credentials: bool = Field(default=False)

    # When absent, /api/v1/health reports database "unconfigured" and scheme
    # endpoints return 503 rather than pretending the catalogue is empty.
    database_url: str | None = Field(default=None)

    # Development/admin escape hatch: lets a caller list draft and needs_review
    # schemes. OFF by default, and it must stay off anywhere a citizen can reach,
    # because unverified rows are unchecked research, not government fact.
    allow_unverified_schemes: bool = Field(default=False)
    # Seconds. Kept short so a dead database cannot hang a health check.
    db_connect_timeout: int = Field(default=3, ge=1, le=30)

    @field_validator("cors_allow_origins")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    @property
    def allow_credentials(self) -> bool:
        """Never combine a wildcard origin with credentialed requests.

        Browsers reject that pairing, and allowing it server-side is a real
        cross-origin risk. If someone sets both, credentials lose.
        """
        if "*" in self.cors_origins:
            return False
        return self.cors_allow_credentials

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url and self.database_url.strip())


@lru_cache
def get_settings() -> Settings:
    """Cached so tests can clear it with get_settings.cache_clear()."""
    return Settings()
