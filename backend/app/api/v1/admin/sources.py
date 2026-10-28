"""Admin endpoints for Government Source Registry and Import Pipeline."""

from __future__ import annotations

import datetime as dt
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.models.government_source import GovernmentSource, ImportCandidate
from app.schemas.sources import (
    GovernmentSourceCreate,
    GovernmentSourceDetail,
    GovernmentSourceListResponse,
    ImportCandidateDetail,
    ImportCandidateListResponse,
    PromoteCandidateResponse,
    TriggerImportRequest,
)
from app.services.admin.authorization import AdminAuth, EditorAuth
from app.services.import_pipeline import registry

router = APIRouter(tags=["admin-sources"])


@router.get(
    "/sources",
    response_model=GovernmentSourceListResponse,
    summary="List registered government sources",
)
def list_sources(
    _auth: AdminAuth,
    db: Annotated[Session, Depends(get_session)],
) -> GovernmentSourceListResponse:
    stmt = select(GovernmentSource).order_by(GovernmentSource.name.asc())
    items = db.execute(stmt).scalars().all()
    return GovernmentSourceListResponse(
        items=[GovernmentSourceDetail.model_validate(s) for s in items],
        total=len(items),
    )


@router.post(
    "/sources",
    response_model=GovernmentSourceDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Register a government source (Editor+)",
)
def create_source(
    auth: EditorAuth,
    payload: GovernmentSourceCreate,
    db: Annotated[Session, Depends(get_session)],
) -> GovernmentSourceDetail:
    source = GovernmentSource(
        name=payload.name,
        official_url=payload.official_url,
        source_type=payload.source_type,
        jurisdiction=payload.jurisdiction,
        state_code=payload.state_code,
        notes=payload.notes,
        is_active=True,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return GovernmentSourceDetail.model_validate(source)


@router.post(
    "/sources/sync",
    response_model=ImportCandidateListResponse,
    summary="Run import adapter for a registered government source (Editor+)",
)
def sync_source(
    auth: EditorAuth,
    payload: TriggerImportRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ImportCandidateListResponse:
    adapter_cls = registry.ADAPTERS.get(payload.source_key)
    if adapter_cls is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown source adapter '{payload.source_key}'. Available: {list(registry.ADAPTERS.keys())}",
        )

    adapter = adapter_cls()
    candidates = registry.run_adapter_import(db, adapter)
    db.commit()

    return ImportCandidateListResponse(
        items=[ImportCandidateDetail.model_validate(c) for c in candidates],
        total=len(candidates),
    )


@router.get(
    "/import-candidates",
    response_model=ImportCandidateListResponse,
    summary="List staged import candidates",
)
def list_import_candidates(
    _auth: AdminAuth,
    db: Annotated[Session, Depends(get_session)],
    candidate_status: Annotated[str | None, Query(alias="status")] = None,
) -> ImportCandidateListResponse:
    stmt = select(ImportCandidate).order_by(ImportCandidate.created_at.desc())
    if candidate_status:
        stmt = stmt.where(ImportCandidate.status == candidate_status)
    items = db.execute(stmt).scalars().all()
    return ImportCandidateListResponse(
        items=[ImportCandidateDetail.model_validate(c) for c in items],
        total=len(items),
    )


@router.post(
    "/import-candidates/{id}/promote",
    response_model=PromoteCandidateResponse,
    summary="Promote candidate into a draft scheme for review (Editor+)",
)
def promote_candidate(
    id: uuid.UUID,
    auth: EditorAuth,
    db: Annotated[Session, Depends(get_session)],
) -> PromoteCandidateResponse:
    user, _ = auth
    try:
        scheme = registry.promote_candidate_to_scheme(db, id, user)
        db.commit()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return PromoteCandidateResponse(
        candidate_id=id,
        scheme_id=scheme.id,
        scheme_slug=scheme.slug,
        review_status=scheme.review_status,
    )


@router.post(
    "/import-candidates/{id}/reject",
    status_code=status.HTTP_200_OK,
    summary="Reject import candidate (Editor+)",
)
def reject_candidate(
    id: uuid.UUID,
    auth: EditorAuth,
    db: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    candidate = db.get(ImportCandidate, id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )
    candidate.status = "rejected"
    candidate.updated_at = dt.datetime.now(dt.UTC)
    db.commit()
    return {"status": "rejected", "id": str(id)}
