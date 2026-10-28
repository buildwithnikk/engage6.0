"""Pipeline orchestration for Government Source Registry and Import Candidates."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Any
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin_user import AdminUser
from app.models.audit_event import AuditEvent
from app.models.government_source import GovernmentSource, ImportCandidate
from app.models.scheme import Scheme
from app.services.admin import scheme_review
from app.services.import_pipeline.adapters.base import BaseSourceAdapter
from app.services.import_pipeline.adapters.haryana_portal import HaryanaPortalAdapter
from app.services.import_pipeline.adapters.national_scholarships import NationalScholarshipAdapter

logger = logging.getLogger(__name__)

ADAPTERS: dict[str, type[BaseSourceAdapter]] = {
    "nsp_central": NationalScholarshipAdapter,
    "haryana_saral": HaryanaPortalAdapter,
}


def get_registered_adapters() -> list[dict[str, Any]]:
    result = []
    for key, cls in ADAPTERS.items():
        inst = cls()
        result.append(
            {
                "key": key,
                "name": inst.name,
                "official_url": inst.official_url,
                "source_type": inst.source_type,
                "jurisdiction": inst.jurisdiction,
                "state_code": inst.state_code,
            }
        )
    return result


def ensure_government_source(db: Session, adapter: BaseSourceAdapter) -> GovernmentSource:
    stmt = select(GovernmentSource).where(
        GovernmentSource.official_url == adapter.official_url
    )
    source = db.execute(stmt).scalars().first()
    if source is None:
        source = GovernmentSource(
            name=adapter.name,
            official_url=adapter.official_url,
            source_type=adapter.source_type,
            jurisdiction=adapter.jurisdiction,
            state_code=adapter.state_code,
            is_active=True,
            notes=f"Auto-registered adapter {adapter.source_key}",
        )
        db.add(source)
        db.flush()
    return source


def run_adapter_import(db: Session, adapter: BaseSourceAdapter) -> list[ImportCandidate]:
    source = ensure_government_source(db, adapter)
    now = dt.datetime.now(dt.UTC)
    source.last_checked_at = now

    candidates_data = adapter.fetch_candidates()
    created_candidates = []

    for item in candidates_data:
        slug = item.get("slug")
        # Check if candidate already exists
        stmt = (
            select(ImportCandidate)
            .where(
                ImportCandidate.source_id == source.id,
                ImportCandidate.external_reference == slug,
            )
        )
        existing = db.execute(stmt).scalars().first()
        if existing is None:
            candidate = ImportCandidate(
                source_id=source.id,
                source_url=item.get("source_url") or source.official_url,
                external_reference=slug,
                extracted_data=item,
                raw_payload={"source_key": adapter.source_key, "extracted_at": now.isoformat()},
                status="pending",
            )
            db.add(candidate)
            created_candidates.append(candidate)
        else:
            existing.extracted_data = item
            existing.updated_at = now
            created_candidates.append(existing)

    db.flush()
    return created_candidates


def promote_candidate_to_scheme(
    db: Session,
    candidate_id: uuid.UUID,
    actor: AdminUser,
) -> Scheme:
    """Promote an import candidate into a draft scheme for review."""
    candidate = db.get(ImportCandidate, candidate_id)
    if candidate is None:
        raise ValueError(f"Candidate {candidate_id} not found.")

    if candidate.status == "promoted" and candidate.promoted_scheme_id:
        existing_scheme = db.get(Scheme, candidate.promoted_scheme_id)
        if existing_scheme:
            return existing_scheme

    data = candidate.extracted_data
    slug = data["slug"]

    # Check if a scheme with this slug already exists
    stmt = select(Scheme).where(Scheme.slug == slug)
    scheme = db.execute(stmt).scalars().first()

    if scheme is None:
        scheme = scheme_review.create_scheme(
            db,
            actor=actor,
            slug=slug,
            official_name=data["official_name"],
            department=data["department"],
            jurisdiction=data["jurisdiction"],
            state_code=data.get("state_code"),
            benefit_summary=data["benefit_summary"],
            eligibility_rules=data["eligibility_rules"],
            required_documents=data.get("required_documents", []),
            official_apply_url=data.get("official_apply_url"),
            source_url=data["source_url"],
        )
    else:
        # Update existing scheme in draft
        scheme.official_name = data["official_name"]
        scheme.department = data["department"]
        scheme.benefit_summary = data["benefit_summary"]
        scheme.eligibility_rules = data["eligibility_rules"]
        scheme.required_documents = data.get("required_documents", [])
        scheme.official_apply_url = data.get("official_apply_url")
        scheme.source_url = data["source_url"]

    candidate.status = "promoted"
    candidate.promoted_scheme_id = scheme.id
    candidate.review_notes = f"Promoted to draft scheme {scheme.slug} by {actor.email} on {dt.datetime.now(dt.UTC).isoformat()}"

    audit = AuditEvent(
        actor_admin_id=actor.id,
        action="scheme_imported_from_candidate",
        resource_type="scheme",
        resource_id=scheme.id,
        metadata_json={
            "candidate_id": str(candidate.id),
            "source_id": str(candidate.source_id),
            "scheme_slug": scheme.slug,
        },
    )
    db.add(audit)
    db.flush()
    return scheme
