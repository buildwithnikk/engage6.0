"""Aggregates the v1 routes.

Phase 1 registers schemes and eligibility. Later phases (documents, complaints,
auth) are gated in docs/phase-plan.md and must not appear here until their phase
opens — a test asserts those paths still return 404.
"""

from fastapi import APIRouter

from app.api.v1 import (
    documents,
    eligibility,
    health,
    preferences,
    preparations,
    schemes,
)
from app.api.v1.admin import admin_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(schemes.router)
api_router.include_router(eligibility.router)
api_router.include_router(documents.router)
api_router.include_router(preparations.router)
api_router.include_router(preferences.router)
api_router.include_router(admin_router)
