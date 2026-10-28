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

    # Phase 2: Admin session cookie configuration
    admin_session_cookie_name: str = Field(default="sahayak_admin_session")
    admin_cookie_secure: bool = Field(default=False)
    admin_cookie_samesite: str = Field(default="lax")

    # Phase 3: Document Upload & Extraction configuration
    document_storage_dir: str = Field(default="/tmp/sahayak_storage/documents")
    document_session_cookie_name: str = Field(default="sahayak_doc_session")
    document_max_file_size: int = Field(default=10 * 1024 * 1024)  # 10 MiB
    document_max_pages: int = Field(default=10)
    document_max_pixels_per_page: int = Field(default=20_000_000)  # 20 MP
    document_max_active_per_session: int = Field(default=3)
    document_processing_timeout_seconds: int = Field(default=30)
    document_retention_minutes: int = Field(default=60)  # 1 hour

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
