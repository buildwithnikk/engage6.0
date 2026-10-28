"""Document session authorization and CSRF protection for visitors."""

from __future__ import annotations

import datetime as dt
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.models.document import DocumentSession
from app.services.document import session_service


def get_current_document_session(
    request: Request,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentSession:
    """Validate and return the visitor's DocumentSession from the HttpOnly cookie.

    Raises 401 if missing or expired.
    """
    raw_token = request.cookies.get(settings.document_session_cookie_name)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Document session required. Please initialize a document session.",
        )

    doc_session = session_service.get_valid_session(db, raw_token)
    if doc_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Document session has expired or is invalid.",
        )

    return doc_session


def require_doc_csrf(
    request: Request,
    doc_session: Annotated[DocumentSession, Depends(get_current_document_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentSession:
    """Verify CSRF token and Origin header for mutating document requests."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        origin = request.headers.get("origin")
        if origin and origin not in settings.cors_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Untrusted origin for document request.",
            )

        csrf_header = request.headers.get("x-csrf-token")
        if not csrf_header or session_service.hash_token(csrf_header) != doc_session.csrf_token_hash:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing CSRF token.",
            )

    return doc_session
