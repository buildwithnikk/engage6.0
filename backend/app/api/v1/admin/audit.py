"""Admin audit event history (superadmin only)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.schemas.admin import AuditEventsResponse, AuditEventSummary
from app.services.admin import scheme_review
from app.services.admin.authorization import SuperAdminAuth

router = APIRouter(prefix="/audit-events", tags=["admin-audit"])


@router.get(
    "",
    response_model=AuditEventsResponse,
    summary="List audit events (admin role only)",
)
def list_audit_events(
    _auth: SuperAdminAuth,
    db: Annotated[Session, Depends(get_session)],
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    resource_id: Annotated[uuid.UUID | None, Query()] = None,
) -> AuditEventsResponse:
    events, total = scheme_review.list_audit_events(
        db,
        resource_id=resource_id,
        page=page,
        page_size=page_size,
    )

    items = [
        AuditEventSummary(
            id=ev.id,
            actor_admin_id=ev.actor_admin_id,
            actor_email=actor_email,
            action=ev.action,
            resource_type=ev.resource_type,
            resource_id=ev.resource_id,
            metadata=ev.metadata_json,
            created_at=ev.created_at,
        )
        for ev, actor_email in events
    ]

    return AuditEventsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
