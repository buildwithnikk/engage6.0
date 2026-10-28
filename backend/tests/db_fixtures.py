"""Database fixtures for integration tests.

Two safety properties, both deliberate:

1. **Never the development database.** The URL comes from TEST_DATABASE_URL, or
   is derived from DATABASE_URL by swapping the database name to `sahayak_test`.
   A test run must not be able to truncate the catalogue someone is working on.
2. **Every test is rolled back.** Each test runs inside a transaction that is
   discarded afterwards, so tests cannot leak rows into each other and the order
   they run in does not matter.

If no PostgreSQL is reachable, these fixtures skip rather than fail: unit tests
still run anywhere, and the skip message says exactly what is missing.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import TYPE_CHECKING
from urllib.parse import urlparse, urlunparse

import pytest

if TYPE_CHECKING:  # pragma: no cover - typing only
    from sqlalchemy.orm import Session

TEST_DB_NAME = "sahayak_test"


def resolve_test_database_url() -> str | None:
    """TEST_DATABASE_URL, else DATABASE_URL redirected to the test database."""
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit

    dev = _read_env_file_value("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not dev:
        return None

    parts = urlparse(dev)
    if parts.path.lstrip("/") == TEST_DB_NAME:
        return dev
    return urlunparse(parts._replace(path=f"/{TEST_DB_NAME}"))


def _read_env_file_value(key: str) -> str | None:
    """Read one key from backend/.env.

    tests/conftest.py disables pydantic's env_file loading so the suite is
    hermetic; this reads the file directly, only to locate the test database.
    """
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, encoding="utf-8") as handle:
            for line in handle:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip()
    except OSError:
        return None
    return None


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = resolve_test_database_url()
    if not url:
        pytest.skip(
            "No test database configured. Run ./scripts/db.sh test-db, or set TEST_DATABASE_URL."
        )
    return url


@pytest.fixture(scope="session")
def engine(test_database_url: str):
    from sqlalchemy import create_engine, text

    eng = create_engine(test_database_url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
    try:
        with eng.connect() as conn:
            # Fail early and clearly if migrations were never applied here.
            exists = conn.execute(
                text("select to_regclass('public.schemes') is not null")
            ).scalar_one()
        if not exists:
            pytest.skip("Test database has no 'schemes' table. Run ./scripts/db.sh test-db.")
    except Exception as exc:  # noqa: BLE001 - any connection problem means skip
        pytest.skip(
            f"Test database unreachable ({type(exc).__name__}). Run ./scripts/db.sh test-db."
        )

    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine) -> Iterator[Session]:
    """A session bound to a transaction that is always rolled back."""
    from sqlalchemy.orm import Session

    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        # A test that deliberately triggers an IntegrityError leaves the
        # transaction already aborted and deassociated; rolling it back again
        # is harmless but noisy, so only do it when it is still live.
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    """TestClient whose requests share the test transaction.

    Overriding the dependency means the API reads and writes inside the same
    rolled-back transaction, so endpoint tests leave no trace.
    """
    from fastapi.testclient import TestClient

    from app.api.deps import get_session
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
