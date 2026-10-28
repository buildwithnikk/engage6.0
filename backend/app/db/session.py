"""Optional database access.

Phase 0 contract: importing this module must never fail and never connect.
SQLAlchemy is imported lazily inside the function so that a machine without the
database extras installed can still import and run the app.

This connection is a *privileged* Postgres connection. It does NOT get Row Level
Security applied to it — see docs/database-schema.md before using it for any
per-user data.
"""

from __future__ import annotations

import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)


def check_database(settings: Settings) -> tuple[str, str | None]:
    """Return (status, detail) where status is 'ok' | 'unconfigured' | 'unavailable'.

    Opens a connection, runs `SELECT 1`, and disposes the engine. Never raises.
    Never returns a detail string containing credentials.
    """
    if not settings.database_configured:
        return "unconfigured", "DATABASE_URL is not set."

    try:
        from sqlalchemy import create_engine, text
    except ModuleNotFoundError:
        logger.warning("sqlalchemy is not installed; cannot verify the database")
        return "unavailable", "Database driver is not installed."

    engine = None
    try:
        engine = create_engine(
            settings.database_url or "",
            pool_pre_ping=True,
            connect_args={"connect_timeout": settings.db_connect_timeout},
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok", None
    except Exception as exc:  # noqa: BLE001 — a health check must not propagate anything
        # Log the class name only. The exception message can contain the host,
        # the user and sometimes the password, so it must not be logged or returned.
        logger.warning("database check failed: %s", type(exc).__name__)
        return "unavailable", f"Could not connect to the database ({type(exc).__name__})."
    finally:
        if engine is not None:
            engine.dispose()


# ---------------------------------------------------------------------------
# Phase 1: a real session for request handlers.
#
# The Phase 0 contract above is unchanged — importing this module still connects
# to nothing. The engine is built on first use and cached, so a process that only
# serves /health never opens a pool.
# ---------------------------------------------------------------------------

from collections.abc import Iterator  # noqa: E402
from functools import lru_cache  # noqa: E402
from typing import TYPE_CHECKING  # noqa: E402

from app.core.config import get_settings  # noqa: E402

if TYPE_CHECKING:  # pragma: no cover - typing only, keeps the import lazy at runtime
    from sqlalchemy.orm import Session


class DatabaseNotConfiguredError(RuntimeError):
    """Raised when a request needs the database but DATABASE_URL is absent.

    The message is deliberately actionable and contains no configuration values.
    """

    def __init__(self) -> None:
        super().__init__(
            "DATABASE_URL is not configured. Copy backend/.env.example to "
            "backend/.env and set it (see README), then restart the API."
        )


@lru_cache
def get_engine():
    """Process-wide engine. Cached, so the pool is created once."""
    from sqlalchemy import create_engine

    settings = get_settings()
    if not settings.database_configured:
        raise DatabaseNotConfiguredError

    url = settings.database_url or ""
    if not url.startswith("postgresql"):
        # Fail loudly and without echoing the value: a wrong scheme here is a
        # configuration mistake, and the URL contains a password.
        raise RuntimeError(
            "DATABASE_URL must be a PostgreSQL URL, for example "
            "postgresql+psycopg://user:password@host:5432/dbname"
        )

    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args={"connect_timeout": settings.db_connect_timeout},
    )


@lru_cache
def get_sessionmaker():
    from sqlalchemy.orm import sessionmaker

    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a session that is always closed.

    Read paths in Phase 1 do not write, so there is no commit here; the rollback
    on exit returns the connection to the pool without leaving an idle
    transaction open.
    """
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def reset_engine_cache() -> None:
    """Drop cached engine/sessionmaker. Used by tests that switch databases."""
    engine = None
    if get_engine.cache_info().currsize:
        try:
            engine = get_engine()
        except Exception:  # noqa: BLE001 - nothing to dispose if it never built
            engine = None
    get_sessionmaker.cache_clear()
    get_engine.cache_clear()
    if engine is not None:
        engine.dispose()
