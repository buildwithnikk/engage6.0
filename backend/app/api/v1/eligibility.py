"""Eligibility check.

Stateless by design: the request carries personal answers, and nothing in this
module writes them anywhere. No row is inserted, no answer is logged, and the
result is not stored. See docs/privacy.md — storing every check would turn a
calculator into a database of citizens' income and caste.
"""

from __future__ import annotations

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.schemas.eligibility import ConditionOutcome, EligibilityRequest, EligibilityResponse
from app.services import scheme_service
from app.services.eligibility.engine import evaluate

router = APIRouter(prefix="/eligibility", tags=["eligibility"])

DISCLAIMER = (
    "This is an informational estimate based on the eligibility rules recorded in "
    "this catalogue. It is not an official decision. Confirm against the scheme's "
    "official source before applying."
)


@router.post(
    "/check",
    response_model=EligibilityResponse,
    summary="Check eligibility against one scheme's recorded rules",
    description=(
        "Deterministic: the same answers and the same `rules_version` always give "
        "the same result. No language model is involved.\n\n"
        "Three outcomes — `eligible`, `ineligible`, and `needs_more_information` "
        "when a required fact is missing or the rules cannot be read. A missing "
        "answer is **never** treated as a pass.\n\n"
        "**Nothing is stored.** The answers are used to compute the response and "
        "then discarded."
    ),
    responses={
        404: {"description": "No such scheme, or it is not publicly visible."},
        503: {"description": "The database is not configured."},
    },
)
def check_eligibility(
    payload: EligibilityRequest,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> EligibilityResponse:
    statuses = scheme_service.visible_statuses(include_unverified=settings.allow_unverified_schemes)
    scheme = scheme_service.get_scheme(session, payload.scheme_id, statuses=statuses)
    if scheme is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")

    result = evaluate(scheme.eligibility_rules, dict(payload.answers))

    def shape(items) -> list[ConditionOutcome]:
        return [
            ConditionOutcome(
                fact=r.fact,
                type=r.type,
                status=r.status,
                requirement=r.requirement,
                explanation=r.explanation,
            )
            for r in items
        ]

    return EligibilityResponse(
        scheme_id=str(scheme.id),
        scheme_slug=scheme.slug,
        official_name=scheme.official_name,
        outcome=result.outcome,
        summary=result.summary,
        met=shape(result.met),
        failed=shape(result.failed),
        unknown=shape(result.unknown),
        missing_facts=result.missing_facts,
        rules_version=scheme.rules_version,
        source_url=scheme.source_url,
        official_apply_url=scheme.official_apply_url,
        review_status=scheme.review_status,
        evaluated_at=dt.datetime.now(dt.UTC).isoformat(),
        disclaimer=DISCLAIMER,
    )
