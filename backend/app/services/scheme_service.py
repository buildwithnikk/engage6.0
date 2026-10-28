"""Scheme domain logic: visibility policy and presentation shaping.

The one rule that matters here: a public caller sees `verified` rows and nothing
else. Draft and needs_review rows are unchecked research; showing them to a
citizen as if they were government fact is the failure mode this whole phase is
built to avoid.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.scheme import PUBLIC_REVIEW_STATUS, Scheme
from app.repositories import scheme_repository as repo
from app.schemas.scheme import FactRequirement, SchemeDetail, SchemeSummary
from app.services.eligibility.engine import required_facts
from app.services.eligibility.rules import UnsupportedRules, parse_rules

#: What an ordinary caller may see. One entry, deliberately.
PUBLIC_STATUSES: tuple[str, ...] = (PUBLIC_REVIEW_STATUS,)

#: Everything, for the documented development/admin path only.
ALL_STATUSES: tuple[str, ...] = ("draft", "needs_review", "verified", "archived")


def visible_statuses(
    *, include_unverified: bool, review_status: str | None = None
) -> tuple[str, ...]:
    """Resolve which statuses a request may see.

    `include_unverified` is granted by the route only when the server is
    explicitly configured to allow it. Without it, an explicit `review_status`
    filter cannot widen visibility — it can only narrow an already-public set,
    which for now means it must be 'verified' or it matches nothing.
    """
    if include_unverified:
        if review_status:
            return (review_status,)
        return ALL_STATUSES

    if review_status and review_status != PUBLIC_REVIEW_STATUS:
        # Asked for drafts without permission: return an empty set rather than
        # an error, so probing cannot distinguish "exists but hidden" from
        # "does not exist".
        return ()
    return PUBLIC_STATUSES


def list_schemes(
    session: Session,
    *,
    statuses: tuple[str, ...],
    query: str | None,
    jurisdiction: str | None,
    state_code: str | None,
    page: int,
    page_size: int,
) -> tuple[list[SchemeSummary], int]:
    if not statuses:
        return [], 0

    rows, total = repo.list_schemes(
        session,
        statuses=statuses,
        query=query,
        jurisdiction=jurisdiction,
        state_code=state_code,
        page=page,
        page_size=page_size,
    )
    return [SchemeSummary.model_validate(row) for row in rows], total


def get_scheme(session: Session, reference: str, *, statuses: tuple[str, ...]) -> Scheme | None:
    if not statuses:
        return None
    return repo.get_by_reference(session, reference, statuses=statuses)


def to_detail(scheme: Scheme) -> SchemeDetail:
    """Shape a row for the detail endpoint, including the questionnaire."""
    try:
        parse_rules(scheme.eligibility_rules)
        readable = True
    except UnsupportedRules:
        readable = False

    facts = [FactRequirement(**f) for f in required_facts(scheme.eligibility_rules)]

    return SchemeDetail(
        **SchemeSummary.model_validate(scheme).model_dump(),
        required_facts=facts,
        rules_readable=readable,
    )
