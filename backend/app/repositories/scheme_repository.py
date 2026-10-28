"""Data access for schemes. SQL lives here and nowhere else.

No HTTP concepts, no Pydantic. The service layer decides policy (such as which
review statuses a caller may see); this layer only fetches what it is asked for.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.scheme import Scheme

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


def _apply_filters(
    stmt,
    *,
    statuses: Sequence[str],
    query: str | None,
    jurisdiction: str | None,
    state_code: str | None,
):
    stmt = stmt.where(Scheme.review_status.in_(statuses))

    if jurisdiction:
        stmt = stmt.where(Scheme.jurisdiction == jurisdiction)

    if state_code:
        # A central scheme applies everywhere, so filtering by state must not
        # hide them — a citizen in UP is eligible for central schemes too.
        stmt = stmt.where(
            or_(
                Scheme.state_code == state_code.upper(),
                Scheme.jurisdiction == "central",
            )
        )

    if query:
        # ILIKE over a few hundred rows. Escape the LIKE wildcards so a user
        # typing '%' searches for a percent sign instead of matching everything.
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        stmt = stmt.where(
            or_(
                Scheme.official_name.ilike(pattern, escape="\\"),
                Scheme.benefit_summary.ilike(pattern, escape="\\"),
                Scheme.department.ilike(pattern, escape="\\"),
            )
        )

    return stmt


def list_schemes(
    session: Session,
    *,
    statuses: Sequence[str],
    query: str | None = None,
    jurisdiction: str | None = None,
    state_code: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[Scheme], int]:
    """Return (rows, total). `total` counts matches, not just this page."""
    page = max(1, page)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))

    base = _apply_filters(
        select(Scheme),
        statuses=statuses,
        query=query,
        jurisdiction=jurisdiction,
        state_code=state_code,
    )

    count_stmt = _apply_filters(
        select(func.count()).select_from(Scheme),
        statuses=statuses,
        query=query,
        jurisdiction=jurisdiction,
        state_code=state_code,
    )
    total = session.execute(count_stmt).scalar_one()

    # Ordering includes id so pagination is stable when names collide; without a
    # total order, a row can appear on two pages or on none.
    rows = (
        session.execute(
            base.order_by(Scheme.official_name.asc(), Scheme.id.asc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        .scalars()
        .all()
    )
    return list(rows), int(total)


def get_by_reference(session: Session, reference: str, *, statuses: Sequence[str]) -> Scheme | None:
    """Look up by UUID or slug, restricted to the given statuses.

    Restricting here rather than after fetching means a caller cannot forget:
    a draft row is simply not returned for a public status list.
    """
    stmt = select(Scheme).where(Scheme.review_status.in_(statuses))

    try:
        as_uuid = uuid.UUID(reference)
    except (ValueError, AttributeError, TypeError):
        stmt = stmt.where(Scheme.slug == reference)
    else:
        stmt = stmt.where(Scheme.id == as_uuid)

    return session.execute(stmt).scalars().first()
