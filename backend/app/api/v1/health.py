"""GET /api/v1/health — the only implemented endpoint in Phase 0."""

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.db.session import check_database
from app.schemas.health import HealthResponse

router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness of the API and the real state of its database connection",
)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    db_status, detail = check_database(settings)
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        database=db_status,
        detail=detail,
    )
