"""Admin authentication and session management.

Password hashing uses Argon2 via pwdlib. Session tokens and CSRF tokens are random
opaque strings; only their SHA-256 hashes are persisted.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import secrets
import time
import uuid
from typing import TYPE_CHECKING

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.admin_session import AdminSession
from app.models.admin_user import AdminUser
from app.models.audit_event import AuditEvent

if TYPE_CHECKING:
    pass

password_hasher = PasswordHash((Argon2Hasher(),))

SESSION_LIFETIME = dt.timedelta(hours=8)
MAX_LOGIN_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 900  # 15 minutes

# In-memory tracking of failed attempts: key -> list of timestamps
_failed_attempts: dict[str, list[float]] = {}


class AuthenticationError(Exception):
    """Base authentication error."""


class InvalidCredentialsError(AuthenticationError):
    """Email or password is not valid. Generic message to prevent account enumeration."""


class InactiveAccountError(AuthenticationError):
    """Account is disabled."""


class RateLimitExceededError(AuthenticationError):
    """Too many failed attempts within window."""


def reset_rate_limits() -> None:
    """Clear in-memory rate limit records (primarily for testing)."""
    _failed_attempts.clear()


def check_rate_limit(key: str) -> None:
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    attempts = [t for t in _failed_attempts.get(key, []) if t > cutoff]
    _failed_attempts[key] = attempts
    if len(attempts) >= MAX_LOGIN_ATTEMPTS:
        raise RateLimitExceededError("Too many failed login attempts. Please try again later.")


def record_failed_attempt(key: str) -> None:
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    attempts = [t for t in _failed_attempts.get(key, []) if t > cutoff]
    attempts.append(now)
    _failed_attempts[key] = attempts


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hasher.verify(plain_password, hashed_password)


def hash_token(raw_token: str) -> str:
    """Hash a token using SHA-256 for database storage/comparison."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_session(
    db: Session,
    user: AdminUser,
    client_ip: str | None = None,
) -> tuple[AdminSession, str, str]:
    """Create a new revocable session.

    Returns:
        (AdminSession, raw_session_token, raw_csrf_token)
    """
    raw_session_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_session_token)

    raw_csrf_token = secrets.token_urlsafe(32)
    csrf_token_hash = hash_token(raw_csrf_token)

    expires_at = dt.datetime.now(dt.UTC) + SESSION_LIFETIME

    admin_session = AdminSession(
        admin_user_id=user.id,
        token_hash=token_hash,
        csrf_token_hash=csrf_token_hash,
        expires_at=expires_at,
    )
    db.add(admin_session)

    user.last_login_at = dt.datetime.now(dt.UTC)

    # Record login audit event
    audit = AuditEvent(
        actor_admin_id=user.id,
        action="admin_login",
        resource_type="admin_session",
        resource_id=admin_session.id,
        metadata_json={"email": user.email, "role": user.role, "client_ip": client_ip},
    )
    db.add(audit)
    db.flush()

    return admin_session, raw_session_token, raw_csrf_token


def authenticate_user(
    db: Session,
    email: str,
    password: str,
    client_ip: str | None = None,
) -> tuple[AdminUser, AdminSession, str, str]:
    """Authenticate an admin user and create a session.

    Returns:
        (AdminUser, AdminSession, raw_session_token, raw_csrf_token)
    """
    normalized_email = email.strip().lower()
    rate_limit_key = f"{normalized_email}:{client_ip or 'unknown'}"
    check_rate_limit(rate_limit_key)

    stmt = select(AdminUser).where(func.lower(func.trim(AdminUser.email)) == normalized_email)
    user = db.execute(stmt).scalars().first()

    if user is None:
        record_failed_attempt(rate_limit_key)
        raise InvalidCredentialsError("Invalid email or password.")

    if not verify_password(password, user.password_hash):
        record_failed_attempt(rate_limit_key)
        raise InvalidCredentialsError("Invalid email or password.")

    if not user.is_active:
        raise InactiveAccountError("Account is disabled.")

    # Successful login: create session
    admin_session, raw_session_token, raw_csrf_token = create_session(db, user, client_ip)
    return user, admin_session, raw_session_token, raw_csrf_token


def get_session_by_token(
    db: Session,
    raw_session_token: str,
) -> tuple[AdminUser, AdminSession] | None:
    """Validate a session token. Returns (AdminUser, AdminSession) or None."""
    token_hash = hash_token(raw_session_token)
    now = dt.datetime.now(dt.UTC)

    stmt = (
        select(AdminSession)
        .where(
            AdminSession.token_hash == token_hash,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
        )
    )
    admin_session = db.execute(stmt).scalars().first()
    if admin_session is None:
        return None

    user = admin_session.user
    if not user.is_active:
        return None

    return user, admin_session


def revoke_session_by_token(
    db: Session,
    raw_session_token: str,
    client_ip: str | None = None,
) -> bool:
    """Revoke a session by its raw token."""
    token_hash = hash_token(raw_session_token)
    stmt = (
        select(AdminSession)
        .where(
            AdminSession.token_hash == token_hash,
            AdminSession.revoked_at.is_(None),
        )
    )
    admin_session = db.execute(stmt).scalars().first()
    if admin_session is None:
        return False

    admin_session.revoked_at = dt.datetime.now(dt.UTC)
    audit = AuditEvent(
        actor_admin_id=admin_session.admin_user_id,
        action="admin_logout",
        resource_type="admin_session",
        resource_id=admin_session.id,
        metadata_json={"client_ip": client_ip},
    )
    db.add(audit)
    db.flush()
    return True


def create_admin_user(
    db: Session,
    email: str,
    password: str,
    role: str = "admin",
    actor_id: uuid.UUID | None = None,
) -> AdminUser:
    """Create a new admin user."""
    normalized_email = email.strip().lower()
    if role not in ("admin", "reviewer", "editor"):
        raise ValueError(f"Invalid role: {role}")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")

    stmt = select(AdminUser).where(func.lower(func.trim(AdminUser.email)) == normalized_email)
    existing = db.execute(stmt).scalars().first()
    if existing is not None:
        raise ValueError(f"Admin user with email '{normalized_email}' already exists.")

    user = AdminUser(
        email=normalized_email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()

    audit = AuditEvent(
        actor_admin_id=actor_id or user.id,
        action="admin_user_created",
        resource_type="admin_user",
        resource_id=user.id,
        metadata_json={"email": user.email, "role": user.role},
    )
    db.add(audit)
    db.flush()
    return user
