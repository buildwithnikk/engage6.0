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
