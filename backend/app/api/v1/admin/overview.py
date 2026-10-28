"""Admin dashboard overview statistics."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.schemas.admin import AdminOverviewResponse
from app.services.admin import scheme_review
from app.services.admin.authorization import AdminAuth

router = APIRouter(prefix="/overview", tags=["admin-overview"])


@router.get(
    "",
    response_model=AdminOverviewResponse,
    summary="Get scheme counts broken down by review status",
)
def get_overview(
    _auth: AdminAuth,
    db: Annotated[Session, Depends(get_session)],
) -> AdminOverviewResponse:
    stats = scheme_review.get_admin_overview(db)
    return AdminOverviewResponse(**stats)
