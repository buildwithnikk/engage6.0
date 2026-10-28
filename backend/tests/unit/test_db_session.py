"""check_database must never raise and never leak credentials."""

from app.core.config import Settings
from app.db.session import check_database


def test_unconfigured_returns_unconfigured():
    status, detail = check_database(Settings(database_url=None))
    assert status == "unconfigured"
    assert detail is not None


def test_unreachable_database_returns_unavailable_without_leaking():
    """A bad host must yield 'unavailable' and must not echo the credentials back."""
    secret = "sup3rs3cret"
    url = f"postgresql+psycopg://postgres:{secret}@127.0.0.1:1/postgres"

    status, detail = check_database(Settings(database_url=url, db_connect_timeout=1))

    assert status == "unavailable"
    assert detail is not None
    assert secret not in detail
    assert "127.0.0.1" not in detail
    assert "postgres" not in detail.lower()
