"""Anonymous document session management for visitors."""

from __future__ import annotations

import datetime as dt
import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import DocumentSession

SESSION_DURATION = dt.timedelta(hours=2)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_document_session(db: Session) -> tuple[DocumentSession, str, str]:
    """Create a new anonymous document session.

    Returns:
        (DocumentSession, raw_token, raw_csrf_token)
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)

    raw_csrf = secrets.token_urlsafe(32)
    csrf_hash = hash_token(raw_csrf)

    now = dt.datetime.now(dt.UTC)
    expires_at = now + SESSION_DURATION

    doc_session = DocumentSession(
        token_hash=token_hash,
        csrf_token_hash=csrf_hash,
        expires_at=expires_at,
    )
    db.add(doc_session)
    db.flush()
    return doc_session, raw_token, raw_csrf


def get_valid_session(db: Session, raw_token: str) -> DocumentSession | None:
    if not raw_token:
        return None
    token_hash = hash_token(raw_token)
    now = dt.datetime.now(dt.UTC)
    stmt = select(DocumentSession).where(
        DocumentSession.token_hash == token_hash,
        DocumentSession.expires_at > now,
    )
    return db.execute(stmt).scalars().first()


def refresh_csrf_token(db: Session, session: DocumentSession) -> str:
    raw_csrf = secrets.token_urlsafe(32)
    session.csrf_token_hash = hash_token(raw_csrf)
    db.flush()
    return raw_csrf


def delete_session(db: Session, raw_token: str) -> bool:
    session = get_valid_session(db, raw_token)
    if session is None:
        return False
    db.delete(session)
    db.flush()
    return True
