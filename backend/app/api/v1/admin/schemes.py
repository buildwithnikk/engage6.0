"""Admin scheme curation and review workflow endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.models.scheme import Scheme
from app.schemas.admin import (
    AdminSchemeCreate,
    AdminSchemeDetail,
    AdminSchemeListResponse,
    AdminSchemeSummary,
    AdminSchemeUpdate,
    RequestChangesRequest,
)
from app.services.admin import scheme_review
from app.services.admin.authorization import AdminAuth, EditorAuth, ReviewerAuth

router = APIRouter(prefix="/schemes", tags=["admin-schemes"])


def _to_admin_detail(scheme: Scheme) -> AdminSchemeDetail:
    return AdminSchemeDetail(
        id=scheme.id,
        slug=scheme.slug,
        official_name=scheme.official_name,
        department=scheme.department,
        jurisdiction=scheme.jurisdiction,  # type: ignore[arg-type]
        state_code=scheme.state_code,
        benefit_summary=scheme.benefit_summary,
        required_documents=scheme.required_documents,  # type: ignore[arg-type]
        official_apply_url=scheme.official_apply_url,
        source_url=scheme.source_url,
        review_status=scheme.review_status,  # type: ignore[arg-type]
        verified_at=scheme.verified_at,
        rules_version=scheme.rules_version,
        created_at=scheme.created_at,
        updated_at=scheme.updated_at,
        eligibility_rules=scheme.eligibility_rules,
    )


def _to_admin_summary(scheme: Scheme) -> AdminSchemeSummary:
    return AdminSchemeSummary(
        id=scheme.id,
        slug=scheme.slug,
        official_name=scheme.official_name,
        department=scheme.department,
        jurisdiction=scheme.jurisdiction,  # type: ignore[arg-type]
        state_code=scheme.state_code,
        benefit_summary=scheme.benefit_summary,
        required_documents=scheme.required_documents,  # type: ignore[arg-type]
        official_apply_url=scheme.official_apply_url,
        source_url=scheme.source_url,
        review_status=scheme.review_status,  # type: ignore[arg-type]
        verified_at=scheme.verified_at,
        rules_version=scheme.rules_version,
        created_at=scheme.created_at,
        updated_at=scheme.updated_at,
    )


@router.get(
    "",
    response_model=AdminSchemeListResponse,
    summary="List schemes across all review statuses",
)
def list_schemes(
    _auth: AdminAuth,
    db: Annotated[Session, Depends(get_session)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    review_status: Annotated[str | None, Query()] = None,
    jurisdiction: Annotated[str | None, Query()] = None,
    state_code: Annotated[str | None, Query(max_length=10)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminSchemeListResponse:
    schemes, total = scheme_review.list_schemes_admin(
        db,
        query=q,
        review_status=review_status,
        jurisdiction=jurisdiction,
        state_code=state_code,
        page=page,
        page_size=page_size,
    )
    items = [_to_admin_summary(s) for s in schemes]
    return AdminSchemeListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=AdminSchemeDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft scheme (Editor+)",
)
def create_scheme(
    auth: EditorAuth,
    payload: AdminSchemeCreate,
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    user, _ = auth
    try:
        scheme = scheme_review.create_scheme(
            db,
            actor=user,
            slug=payload.slug,
            official_name=payload.official_name,
            department=payload.department,
            jurisdiction=payload.jurisdiction,
            state_code=payload.state_code,
            benefit_summary=payload.benefit_summary,
            eligibility_rules=payload.eligibility_rules,
            required_documents=payload.required_documents,
            official_apply_url=payload.official_apply_url,
            source_url=payload.source_url,
        )
        db.commit()
    except scheme_review.ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return _to_admin_detail(scheme)


@router.get(
    "/{id}",
    response_model=AdminSchemeDetail,
    summary="Get full admin details of a scheme by ID or slug",
)
def get_scheme(
    _auth: AdminAuth,
    id: Annotated[str, Path(description="UUID or slug")],
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    try:
        scheme = scheme_review.get_scheme_by_id_or_slug(db, id)
    except scheme_review.SchemeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return _to_admin_detail(scheme)


@router.patch(
    "/{id}",
    response_model=AdminSchemeDetail,
    summary="Update scheme fields with concurrency guard (Editor+)",
)
def update_scheme(
    auth: EditorAuth,
    id: Annotated[str, Path(description="UUID or slug")],
    payload: AdminSchemeUpdate,
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    user, _ = auth
    try:
        scheme, _ = scheme_review.update_scheme(
            db,
            actor=user,
            scheme_id=id,
            expected_updated_at=payload.expected_updated_at,
            slug=payload.slug,
            official_name=payload.official_name,
            department=payload.department,
            jurisdiction=payload.jurisdiction,
            state_code=payload.state_code,
            benefit_summary=payload.benefit_summary,
            eligibility_rules=payload.eligibility_rules,
            required_documents=payload.required_documents,
            official_apply_url=payload.official_apply_url,
            source_url=payload.source_url,
        )
        db.commit()
    except scheme_review.SchemeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except scheme_review.ConcurrencyConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except scheme_review.ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return _to_admin_detail(scheme)


@router.post(
    "/{id}/submit-review",
    response_model=AdminSchemeDetail,
    summary="Submit draft scheme for review (Editor+)",
)
def submit_review(
    auth: EditorAuth,
    id: Annotated[str, Path(description="UUID or slug")],
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    user, _ = auth
    try:
        scheme = scheme_review.submit_for_review(db, actor=user, scheme_id=id)
        db.commit()
    except scheme_review.SchemeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except scheme_review.InvalidStateTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except scheme_review.ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return _to_admin_detail(scheme)


@router.post(
    "/{id}/verify",
    response_model=AdminSchemeDetail,
    summary="Verify and publish scheme (Reviewer+)",
)
def verify_scheme(
    auth: ReviewerAuth,
    id: Annotated[str, Path(description="UUID or slug")],
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    user, _ = auth
    try:
        scheme = scheme_review.verify_scheme(db, actor=user, scheme_id=id)
        db.commit()
    except scheme_review.SchemeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except scheme_review.InvalidStateTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except scheme_review.ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return _to_admin_detail(scheme)


@router.post(
    "/{id}/request-changes",
    response_model=AdminSchemeDetail,
    summary="Request changes on submitted scheme (Reviewer+)",
)
def request_changes(
    auth: ReviewerAuth,
    id: Annotated[str, Path(description="UUID or slug")],
    payload: RequestChangesRequest,
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    user, _ = auth
    try:
        scheme = scheme_review.request_changes(
            db, actor=user, scheme_id=id, reason=payload.reason
        )
        db.commit()
    except scheme_review.SchemeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except scheme_review.InvalidStateTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except scheme_review.ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return _to_admin_detail(scheme)


@router.post(
    "/{id}/archive",
    response_model=AdminSchemeDetail,
    summary="Archive scheme (Reviewer+)",
)
def archive_scheme(
    auth: ReviewerAuth,
    id: Annotated[str, Path(description="UUID or slug")],
    db: Annotated[Session, Depends(get_session)],
) -> AdminSchemeDetail:
    user, _ = auth
    try:
        scheme = scheme_review.archive_scheme(db, actor=user, scheme_id=id)
        db.commit()
    except scheme_review.SchemeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return _to_admin_detail(scheme)
