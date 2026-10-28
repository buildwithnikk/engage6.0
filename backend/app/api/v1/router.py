"""Aggregates the v1 routes.

Phase 1 will add scheme and eligibility routers here. They are not registered yet
and no placeholder route is exposed — an endpoint that exists but does nothing is
worse than one that is documented as planned.
"""

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)
