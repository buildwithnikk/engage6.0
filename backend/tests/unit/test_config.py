"""Settings behaviour — especially the two rules that matter for safety:
no wildcard-plus-credentials, and no database claim without a DATABASE_URL.
"""

from app.core.config import Settings


def test_database_unconfigured_by_default():
    s = Settings(database_url=None)
    assert s.database_configured is False


def test_database_configured_detects_blank_string():
    assert Settings(database_url="   ").database_configured is False
    assert Settings(database_url="postgresql://u:p@h:5432/db").database_configured is True


def test_cors_origins_are_split_and_trimmed():
    s = Settings(cors_allow_origins="http://localhost:3000, http://127.0.0.1:3000 ")
    assert s.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_wildcard_origin_forces_credentials_off():
    """A wildcard origin combined with credentials is refused, even if configured."""
    s = Settings(cors_allow_origins="*", cors_allow_credentials=True)
    assert s.cors_origins == ["*"]
    assert s.allow_credentials is False


def test_credentials_allowed_with_explicit_origin():
    s = Settings(cors_allow_origins="http://localhost:3000", cors_allow_credentials=True)
    assert s.allow_credentials is True
