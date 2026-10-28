"""Visitor endpoints for Phase 5 locale and geographic preferences."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.core.location_data import (
    CURATED_STATES,
    LOCALE_REGISTRY,
    SUPPORTED_LANGUAGE_CODES,
    VALID_AREA_TYPES,
)
from app.models.document import DocumentSession
from app.schemas.preferences import (
    LocaleItem,
    LocationMetadataResponse,
    PreferencesResponse,
    StateItem,
    UpdatePreferencesRequest,
    UserPreferences,
)
from app.services.document import session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/preferences", tags=["preferences"])


def _resolve_or_create_session(
    request: Request,
    response: Response,
    db: Session,
    settings: Settings,
) -> tuple[DocumentSession, str | None]:
    """Retrieve existing valid session or create an anonymous one."""
    raw_token = request.cookies.get(settings.document_session_cookie_name)
    doc_session = session_service.get_valid_session(db, raw_token) if raw_token else None

    raw_csrf: str | None = None
    if doc_session is None:
        doc_session, new_token, raw_csrf = session_service.create_document_session(db)
        db.commit()
        response.set_cookie(
            key=settings.document_session_cookie_name,
            value=new_token,
            httponly=True,
            secure=settings.admin_cookie_secure,
            samesite=settings.admin_cookie_samesite,
            max_age=7200,
            path="/",
        )
        response.headers["X-CSRF-Token"] = raw_csrf
    return doc_session, raw_csrf


@router.get(
    "/metadata",
    response_model=LocationMetadataResponse,
    summary="Get curated states, districts and locale registry",
)
def get_location_metadata() -> LocationMetadataResponse:
    states = [
        StateItem(
            code=code,
            name=info["name"],
            name_hi=info["name_hi"],
            districts=info["districts"],
        )
        for code, info in sorted(CURATED_STATES.items())
    ]
    locales = [LocaleItem(**l) for l in LOCALE_REGISTRY]
    return LocationMetadataResponse(states=states, locales=locales)


@router.get(
    "",
    response_model=PreferencesResponse,
    summary="Get visitor preferences from session",
)
def get_preferences(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PreferencesResponse:
    raw_token = request.cookies.get(settings.document_session_cookie_name)
    doc_session = session_service.get_valid_session(db, raw_token) if raw_token else None

    if doc_session is None:
        return PreferencesResponse(
            preferences=UserPreferences(),
            has_set_preferences=False,
            csrf_token=None,
        )

    stored = doc_session.preferences or {}
    has_set = bool(stored.get("state_code") or stored.get("language"))
    pref = UserPreferences(
        language=stored.get("language", "en"),
        state_code=stored.get("state_code"),
        district=stored.get("district"),
        area_type=stored.get("area_type", "skip"),
    )
    return PreferencesResponse(
        preferences=pref,
        has_set_preferences=has_set,
        csrf_token=None,
    )


@router.put(
    "",
    response_model=PreferencesResponse,
    summary="Update visitor preferences in session",
)
def update_preferences(
    request: Request,
    response: Response,
    payload: UpdatePreferencesRequest,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PreferencesResponse:
    doc_session, csrf_token = _resolve_or_create_session(request, response, db, settings)

    current = dict(doc_session.preferences or {})

    # Validate language
    if payload.language is not None:
        lang = payload.language.strip().lower()
        if lang not in SUPPORTED_LANGUAGE_CODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Language '{payload.language}' is not yet supported. Fully supported: {sorted(SUPPORTED_LANGUAGE_CODES)}",
            )
        current["language"] = lang

    # Validate state_code
    if payload.state_code is not None:
        state = payload.state_code.strip().upper() if payload.state_code.strip() else None
        if state and state not in CURATED_STATES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid state code '{payload.state_code}'. Must be one of {sorted(CURATED_STATES.keys())}",
            )
        current["state_code"] = state
        # If state changed, ensure district is cleared if not belonging to new state
        if current.get("district") and state:
            if current["district"] not in CURATED_STATES[state]["districts"]:
                current["district"] = None

    # Validate district
    if payload.district is not None:
        district_val = payload.district.strip() if payload.district.strip() else None
        if district_val:
            state_for_district = current.get("state_code")
            if not state_for_district or state_for_district not in CURATED_STATES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="State must be selected before selecting a district.",
                )
            valid_districts = CURATED_STATES[state_for_district]["districts"]
            if district_val not in valid_districts:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"District '{district_val}' is not valid for state {state_for_district}.",
                )
        current["district"] = district_val

    # Validate area_type
    if payload.area_type is not None:
        if payload.area_type not in VALID_AREA_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Area type must be one of {sorted(VALID_AREA_TYPES)}",
            )
        current["area_type"] = payload.area_type

    doc_session.preferences = current
    db.commit()

    pref = UserPreferences(
        language=current.get("language", "en"),
        state_code=current.get("state_code"),
        district=current.get("district"),
        area_type=current.get("area_type", "skip"),
    )
    return PreferencesResponse(
        preferences=pref,
        has_set_preferences=True,
        csrf_token=csrf_token,
    )


@router.delete(
    "",
    response_model=PreferencesResponse,
    summary="Reset visitor preferences in session",
)
def reset_preferences(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PreferencesResponse:
    raw_token = request.cookies.get(settings.document_session_cookie_name)
    doc_session = session_service.get_valid_session(db, raw_token) if raw_token else None

    if doc_session is not None:
        doc_session.preferences = {}
        db.commit()

    return PreferencesResponse(
        preferences=UserPreferences(),
        has_set_preferences=False,
        csrf_token=None,
    )
