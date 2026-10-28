"""Admin authorization dependencies and request guards."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.models.admin_session import AdminSession
from app.models.admin_user import AdminUser
from app.services.admin.authentication import get_session_by_token, hash_token


def get_current_admin_user_and_session(
    request: Request,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> tuple[AdminUser, AdminSession]:
    """Retrieve the authenticated admin user and session from the HttpOnly cookie."""
    cookie_token = request.cookies.get(settings.admin_session_cookie_name)
    if not cookie_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    result = get_session_by_token(db, cookie_token)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again.",
        )

    return result


def require_csrf(
    request: Request,
    auth: Annotated[tuple[AdminUser, AdminSession], Depends(get_current_admin_user_and_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> tuple[AdminUser, AdminSession]:
    """Enforce CSRF token and Origin header for state-changing operations."""
    user, admin_session = auth

    if request.method in ("POST", "PATCH", "PUT", "DELETE"):
        # Validate Origin header if present against configured CORS origins
        origin = request.headers.get("origin")
        if origin and origin not in settings.cors_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Untrusted origin for state-changing request.",
            )

        # Validate X-CSRF-Token header against hashed session token
        csrf_header = request.headers.get("x-csrf-token")
        if not csrf_header or hash_token(csrf_header) != admin_session.csrf_token_hash:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing CSRF token.",
            )

    return user, admin_session


def require_role(*allowed_roles: str):
    """Dependency factory checking that the authenticated admin user has one of allowed_roles."""

    def role_checker(
        auth: Annotated[tuple[AdminUser, AdminSession], Depends(require_csrf)],
    ) -> tuple[AdminUser, AdminSession]:
        user, _ = auth
        if user.role not in allowed_roles:
            roles_str = ", ".join(allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of roles: {roles_str} (current: {user.role}).",
            )
        return auth

    return role_checker


# Role dependencies
AdminAuth = Annotated[tuple[AdminUser, AdminSession], Depends(require_csrf)]
EditorAuth = Annotated[
    tuple[AdminUser, AdminSession], Depends(require_role("editor", "reviewer", "admin"))
]
ReviewerAuth = Annotated[
    tuple[AdminUser, AdminSession], Depends(require_role("reviewer", "admin"))
]
SuperAdminAuth = Annotated[tuple[AdminUser, AdminSession], Depends(require_role("admin"))]
