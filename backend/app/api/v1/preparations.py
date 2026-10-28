"""Visitor endpoints for Phase 4 assisted application preparation drafts."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.models.document import DocumentSession
from app.models.preparation_draft import PreparationDraft
from app.models.scheme import PUBLIC_REVIEW_STATUS, Scheme
from app.schemas.preparation import (
    ConditionSummary,
    EligibilitySummary,
    PreparationDraftCreateRequest,
    PreparationDraftResponse,
    PreparationDraftUpdateRequest,
)
from app.services.document import session_service
from app.services.document.authorization import (
    get_current_document_session,
    require_doc_csrf,
)
from app.services.eligibility.engine import EvaluationResult, evaluate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["preparations"])


def _find_verified_scheme(db: Session, scheme_id_or_slug: str) -> Scheme | None:
    """Find a verified scheme by UUID or slug."""
    try:
        scheme_uuid = uuid.UUID(scheme_id_or_slug)
        stmt = select(Scheme).where(
            Scheme.id == scheme_uuid,
            Scheme.review_status == PUBLIC_REVIEW_STATUS,
        )
    except ValueError:
        stmt = select(Scheme).where(
            Scheme.slug == scheme_id_or_slug,
            Scheme.review_status == PUBLIC_REVIEW_STATUS,
        )
    return db.execute(stmt).scalars().first()


def _build_eligibility_summary(raw_rules: dict, answers: dict) -> EligibilitySummary:
    """Run Phase 1 eligibility engine to determine status and missing facts."""
    eval_res: EvaluationResult = evaluate(raw_rules, answers)

    def to_cond(c) -> ConditionSummary:
        return ConditionSummary(
            fact=c.fact,
            requirement=c.requirement,
            explanation=c.explanation,
            status=c.status,
        )

    return EligibilitySummary(
        outcome=eval_res.outcome,
        summary=eval_res.summary,
        missing_fields=eval_res.missing_facts,
        met=[to_cond(c) for c in eval_res.met],
        failed=[to_cond(c) for c in eval_res.failed],
        unknown=[to_cond(c) for c in eval_res.unknown],
    )


def _to_response(draft: PreparationDraft, scheme: Scheme) -> PreparationDraftResponse:
    eligibility_summary = _build_eligibility_summary(scheme.eligibility_rules, draft.answers)
    return PreparationDraftResponse(
        id=draft.id,
        scheme_id=scheme.id,
        scheme_slug=scheme.slug,
        scheme_name=scheme.official_name,
        department=scheme.department,
        official_apply_url=scheme.official_apply_url,
        source_url=scheme.source_url,
        required_documents=scheme.required_documents or [],
        answers=draft.answers or {},
        checklist_state=draft.checklist_state or {},
        eligibility_summary=eligibility_summary,
        expires_at=draft.expires_at,
        updated_at=draft.updated_at,
    )


@router.post(
    "/preparations",
    response_model=PreparationDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or load an application preparation draft",
)
def create_or_get_preparation_draft(
    request: Request,
    response: Response,
    payload: PreparationDraftCreateRequest,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PreparationDraftResponse:
    # 1. Resolve or create anonymous document session
    raw_token = request.cookies.get(settings.document_session_cookie_name)
    doc_session = session_service.get_valid_session(db, raw_token) if raw_token else None

    if doc_session is None:
        doc_session, new_raw_token, raw_csrf = session_service.create_document_session(db)
        response.set_cookie(
            key=settings.document_session_cookie_name,
            value=new_raw_token,
            httponly=True,
            secure=settings.admin_cookie_secure,
            samesite=settings.admin_cookie_samesite,
            max_age=7200,
            path="/",
        )
        response.headers["X-CSRF-Token"] = raw_csrf
    else:
        # If session exists and CSRF is provided on state mutation, verify
        csrf_header = request.headers.get("x-csrf-token")
        if csrf_header and session_service.hash_token(csrf_header) != doc_session.csrf_token_hash:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid CSRF token.",
            )

    # 2. Look up verified scheme
    scheme = _find_verified_scheme(db, payload.scheme_id)
    if scheme is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found or not verified for public preparation.",
        )

    # 3. Check if draft already exists for this (session, scheme)
    stmt = select(PreparationDraft).where(
        PreparationDraft.session_id == doc_session.id,
        PreparationDraft.scheme_id == scheme.id,
    )
    draft = db.execute(stmt).scalars().first()

    now = dt.datetime.now(dt.UTC)
    expires_at = now + dt.timedelta(minutes=settings.document_retention_minutes)

    if draft is None:
        draft = PreparationDraft(
            session_id=doc_session.id,
            scheme_id=scheme.id,
            answers=payload.answers,
            checklist_state=payload.checklist_state,
            expires_at=expires_at,
        )
        db.add(draft)
    else:
        # Merge answers if new answers provided
        if payload.answers:
            current_answers = dict(draft.answers or {})
            current_answers.update(payload.answers)
            draft.answers = current_answers
        if payload.checklist_state:
            current_chk = dict(draft.checklist_state or {})
            current_chk.update(payload.checklist_state)
            draft.checklist_state = current_chk
        draft.expires_at = expires_at

    db.commit()
    db.refresh(draft)

    return _to_response(draft, scheme)


@router.get(
    "/preparations/{draft_id}",
    response_model=PreparationDraftResponse,
    summary="Get an existing application preparation draft",
)
def get_preparation_draft(
    draft_id: uuid.UUID,
    doc_session: Annotated[DocumentSession, Depends(get_current_document_session)],
    db: Annotated[Session, Depends(get_session)],
) -> PreparationDraftResponse:
    stmt = (
        select(PreparationDraft)
        .where(
            PreparationDraft.id == draft_id,
            PreparationDraft.session_id == doc_session.id,
        )
    )
    draft = db.execute(stmt).scalars().first()
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preparation draft not found.",
        )

    scheme = _find_verified_scheme(db, str(draft.scheme_id))
    if scheme is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme is no longer available.",
        )

    return _to_response(draft, scheme)


@router.patch(
    "/preparations/{draft_id}",
    response_model=PreparationDraftResponse,
    summary="Update answers or checklist in preparation draft",
)
def update_preparation_draft(
    draft_id: uuid.UUID,
    payload: PreparationDraftUpdateRequest,
    doc_session: Annotated[DocumentSession, Depends(require_doc_csrf)],
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PreparationDraftResponse:
    stmt = (
        select(PreparationDraft)
        .where(
            PreparationDraft.id == draft_id,
            PreparationDraft.session_id == doc_session.id,
        )
    )
    draft = db.execute(stmt).scalars().first()
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preparation draft not found.",
        )

    scheme = _find_verified_scheme(db, str(draft.scheme_id))
    if scheme is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme is no longer available.",
        )

    if payload.answers is not None:
        draft.answers = payload.answers
    if payload.checklist_state is not None:
        draft.checklist_state = payload.checklist_state

    # Extend expiry
    now = dt.datetime.now(dt.UTC)
    draft.expires_at = now + dt.timedelta(minutes=settings.document_retention_minutes)

    db.commit()
    db.refresh(draft)

    return _to_response(draft, scheme)


@router.delete(
    "/preparations/{draft_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete preparation draft",
)
def delete_preparation_draft(
    draft_id: uuid.UUID,
    doc_session: Annotated[DocumentSession, Depends(require_doc_csrf)],
    db: Annotated[Session, Depends(get_session)],
) -> Response:
    stmt = (
        select(PreparationDraft)
        .where(
            PreparationDraft.id == draft_id,
            PreparationDraft.session_id == doc_session.id,
        )
    )
    draft = db.execute(stmt).scalars().first()
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preparation draft not found.",
        )

    db.delete(draft)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
