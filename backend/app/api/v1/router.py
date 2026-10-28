"""Aggregates the v1 routes.

Phase 1 registers schemes and eligibility. Later phases (documents, complaints,
auth) are gated in docs/phase-plan.md and must not appear here until their phase
opens — a test asserts those paths still return 404.
"""

from fastapi import APIRouter

from app.api.v1 import eligibility, health, schemes

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(schemes.router)
api_router.include_router(eligibility.router)
