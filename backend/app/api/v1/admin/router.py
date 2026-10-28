"""Aggregates all /api/v1/admin routes."""

from fastapi import APIRouter

from app.api.v1.admin import audit, auth, overview, schemes, sources

admin_router = APIRouter(prefix="/admin")

admin_router.include_router(auth.router)
admin_router.include_router(overview.router)
admin_router.include_router(schemes.router)
admin_router.include_router(sources.router)
admin_router.include_router(audit.router)
