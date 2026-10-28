"""Shared route dependencies."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import DatabaseNotConfiguredError, get_db


def get_session() -> Iterator[Session]:
    """Database session for a request.

    Turns a missing configuration into 503 with an actionable message. The
    alternative — an empty catalogue — would be a silent lie: "no schemes found"
    and "the database is not configured" must not look the same to a caller.
    """
    try:
        yield from get_db()
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
