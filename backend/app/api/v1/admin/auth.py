"""Admin authentication endpoints."""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.schemas.admin import AdminUserSummary, LoginRequest, LoginResponse, MeResponse
from app.services.admin import authentication as auth_service
from app.services.admin.authorization import AdminAuth

router = APIRouter(tags=["admin-auth"])


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    summary="Establish an administrative session",
    description=(
        "Authenticates an admin user with Argon2-verified credentials. "
        "Sets a secure HttpOnly session cookie and returns a CSRF token."
    ),
)
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    client_ip = request.client.host if request.client else "unknown"

    try:
        user, admin_session, raw_session_token, raw_csrf_token = (
            auth_service.authenticate_user(
                db,
                email=payload.email,
                password=payload.password,
                client_ip=client_ip,
            )
        )
        db.commit()
    except auth_service.RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except auth_service.InactiveAccountError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except auth_service.InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    # Set HttpOnly session cookie
    response.set_cookie(
        key=settings.admin_session_cookie_name,
        value=raw_session_token,
        httponly=True,
        secure=settings.admin_cookie_secure,
        samesite=settings.admin_cookie_samesite,
        max_age=int(auth_service.SESSION_LIFETIME.total_seconds()),
        path="/",
    )

    return LoginResponse(
        user=AdminUserSummary.model_validate(user),
        csrf_token=raw_csrf_token,
    )


@router.post(
    "/auth/logout",
    summary="Revoke the current administrative session",
    description="Revokes the database session and clears the HttpOnly cookie.",
)
def logout(
    request: Request,
    response: Response,
    auth: AdminAuth,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    cookie_token = request.cookies.get(settings.admin_session_cookie_name)
    if cookie_token:
        client_ip = request.client.host if request.client else "unknown"
        auth_service.revoke_session_by_token(db, cookie_token, client_ip=client_ip)
        db.commit()

    response.delete_cookie(
        key=settings.admin_session_cookie_name,
        path="/",
        secure=settings.admin_cookie_secure,
        samesite=settings.admin_cookie_samesite,
    )
    return {"status": "ok"}


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get authenticated admin identity and active CSRF token",
)
def get_me(
    auth: AdminAuth,
    db: Annotated[Session, Depends(get_session)],
) -> MeResponse:
    user, admin_session = auth

    # Rotate / issue fresh CSRF token for the session
    new_raw_csrf = secrets.token_urlsafe(32)
    admin_session.csrf_token_hash = auth_service.hash_token(new_raw_csrf)
    db.commit()

    return MeResponse(
        user=AdminUserSummary.model_validate(user),
        csrf_token=new_raw_csrf,
    )
