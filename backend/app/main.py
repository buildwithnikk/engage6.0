"""Sahayak FastAPI application.

Owns all domain logic, AI processing and database access for the platform.
The Next.js frontend holds no business logic; it calls this service.

Startup contract: the app imports and serves with no Supabase credentials present.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Sahayak backend. Phase 0 exposes only /api/v1/health. "
            "Scheme catalogue and eligibility endpoints are planned for Phase 1 — "
            "see docs/api-contracts.md."
        ),
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # allow_credentials is forced off when a wildcard origin is configured.
        allow_credentials=settings.allow_credentials,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    )

    app.include_router(api_router, prefix="/api/v1")

    logger.info(
        "Sahayak API %s starting (environment=%s, database_configured=%s, cors=%s)",
        settings.app_version,
        settings.environment,
        settings.database_configured,
        settings.cors_origins,
    )

    return app


app = create_app()
