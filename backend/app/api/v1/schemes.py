"""Scheme catalogue endpoints.

Thin: parse, delegate, return. Visibility policy lives in the service layer.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.repositories.scheme_repository import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.scheme import SchemeDetail, SchemeListResponse
from app.services import scheme_service

router = APIRouter(prefix="/schemes", tags=["schemes"])


@router.get(
    "",
    response_model=SchemeListResponse,
    summary="List schemes in the catalogue",
    description=(
        "Returns **verified** schemes only. Draft and needs-review records are "
        "unchecked research and are never served here.\n\n"
        "`review_status` can only narrow the public set; it cannot widen it. A "
        "server with `ALLOW_UNVERIFIED_SCHEMES=true` (development only) may also "
        "return unverified records.\n\n"
        "Filtering by `state_code` also returns central schemes, which apply "
        "everywhere."
    ),
)
def list_schemes(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    q: Annotated[
        str | None,
        Query(max_length=100, description="Free text over name, summary and department."),
    ] = None,
    jurisdiction: Annotated[str | None, Query(pattern="^(central|state)$")] = None,
    state_code: Annotated[str | None, Query(max_length=10)] = None,
    review_status: Annotated[
        str | None, Query(pattern="^(draft|needs_review|verified|archived)$")
    ] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> SchemeListResponse:
    statuses = scheme_service.visible_statuses(
        include_unverified=settings.allow_unverified_schemes,
        review_status=review_status,
    )
    items, total = scheme_service.list_schemes(
        session,
        statuses=statuses,
        query=q,
        jurisdiction=jurisdiction,
        state_code=state_code,
        page=page,
        page_size=page_size,
    )
    return SchemeListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{scheme_id}",
    response_model=SchemeDetail,
    summary="Get one scheme by UUID or slug",
    description=(
        "`scheme_id` accepts either the UUID or the slug.\n\n"
        "A non-verified scheme returns **404**, not 403 — a public caller should "
        "not be able to tell the difference between a hidden record and one that "
        "does not exist.\n\n"
        "The response includes `required_facts`, which describes the questions the "
        "eligibility check needs, so the client never hardcodes rule vocabulary."
    ),
    responses={404: {"description": "No such scheme, or it is not publicly visible."}},
)
def get_scheme(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    scheme_id: Annotated[str, Path(max_length=200, description="UUID or slug")],
) -> SchemeDetail:
    statuses = scheme_service.visible_statuses(include_unverified=settings.allow_unverified_schemes)
    scheme = scheme_service.get_scheme(session, scheme_id, statuses=statuses)
    if scheme is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")
    return scheme_service.to_detail(scheme)
