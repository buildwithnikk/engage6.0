"""Scheme review, curation, state transitions, and audit trail services."""

from __future__ import annotations

import datetime as dt
import re
import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.admin_user import AdminUser
from app.models.audit_event import AuditEvent
from app.models.scheme import Scheme
from app.services.eligibility.rules import UnsupportedRules, parse_rules

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class SchemeReviewError(Exception):
    """Base error for scheme review operations."""


class SchemeNotFoundError(SchemeReviewError):
    """Scheme does not exist."""


class ConcurrencyConflictError(SchemeReviewError):
    """Optimistic lock failed: scheme was modified concurrently."""


class InvalidStateTransitionError(SchemeReviewError):
    """The requested state transition is not permitted."""


class ValidationError(SchemeReviewError):
    """Validation failed on scheme data."""


def validate_url(url: str | None, field_name: str, required: bool = False) -> None:
    if not url or not url.strip():
        if required:
            raise ValidationError(f"{field_name} is required.")
        return
    trimmed = url.strip()
    if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
        raise ValidationError(f"{field_name} must be a valid HTTP or HTTPS URL.")


def validate_rules(rules: dict[str, Any]) -> None:
    if not isinstance(rules, dict):
        raise ValidationError("eligibility_rules must be a JSON object.")
    try:
        parse_rules(rules)
    except UnsupportedRules as exc:
        raise ValidationError(f"Invalid eligibility rules: {exc}") from exc


def get_admin_overview(db: Session) -> dict[str, int]:
    """Return count of schemes by review status."""
    stmt = select(Scheme.review_status, func.count()).group_by(Scheme.review_status)
    rows = db.execute(stmt).all()
    counts = {status: count for status, count in rows}
    total = sum(counts.values())
    return {
        "total": total,
        "draft": counts.get("draft", 0),
        "needs_review": counts.get("needs_review", 0),
        "verified": counts.get("verified", 0),
        "archived": counts.get("archived", 0),
    }


def list_schemes_admin(
    db: Session,
    *,
    query: str | None = None,
    review_status: str | None = None,
    jurisdiction: str | None = None,
    state_code: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Scheme], int]:
    """Paginated scheme listing for admins/editors/reviewers across all statuses."""
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    stmt = select(Scheme)
    count_stmt = select(func.count()).select_from(Scheme)

    if review_status:
        stmt = stmt.where(Scheme.review_status == review_status)
        count_stmt = count_stmt.where(Scheme.review_status == review_status)

    if jurisdiction:
        stmt = stmt.where(Scheme.jurisdiction == jurisdiction)
        count_stmt = count_stmt.where(Scheme.jurisdiction == jurisdiction)

    if state_code:
        stmt = stmt.where(
            or_(
                Scheme.state_code == state_code.upper(),
                Scheme.jurisdiction == "central",
            )
        )
        count_stmt = count_stmt.where(
            or_(
                Scheme.state_code == state_code.upper(),
                Scheme.jurisdiction == "central",
            )
        )

    if query:
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        condition = or_(
            Scheme.official_name.ilike(pattern, escape="\\"),
            Scheme.slug.ilike(pattern, escape="\\"),
            Scheme.benefit_summary.ilike(pattern, escape="\\"),
            Scheme.department.ilike(pattern, escape="\\"),
        )
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    total = db.execute(count_stmt).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Scheme.updated_at.desc(), Scheme.id.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        .scalars()
        .all()
    )
    return list(rows), int(total)


def get_scheme_by_id_or_slug(db: Session, identifier: str) -> Scheme:
    try:
        as_uuid = uuid.UUID(identifier)
        stmt = select(Scheme).where(Scheme.id == as_uuid)
    except (ValueError, AttributeError):
        stmt = select(Scheme).where(Scheme.slug == identifier)

    scheme = db.execute(stmt).scalars().first()
    if scheme is None:
        raise SchemeNotFoundError(f"Scheme '{identifier}' not found.")
    return scheme


def create_scheme(
    db: Session,
    actor: AdminUser,
    *,
    slug: str,
    official_name: str,
    department: str,
    jurisdiction: str,
    state_code: str | None,
    benefit_summary: str,
    eligibility_rules: dict[str, Any],
    required_documents: list[str],
    official_apply_url: str | None,
    source_url: str,
) -> Scheme:
    """Create a new scheme in 'draft' status."""
    slug_clean = slug.strip().lower()
    if not SLUG_PATTERN.match(slug_clean):
        raise ValidationError(
            "Slug must be lowercase alphanumeric with hyphens (e.g. 'pm-kisan')."
        )

    # Check slug uniqueness
    stmt = select(Scheme).where(Scheme.slug == slug_clean)
    if db.execute(stmt).scalars().first() is not None:
        raise ValidationError(f"A scheme with slug '{slug_clean}' already exists.")

    if jurisdiction not in ("central", "state"):
        raise ValidationError("Jurisdiction must be 'central' or 'state'.")

    state_code_clean = state_code.strip().upper() if state_code else None
    if jurisdiction == "state" and not state_code_clean:
        raise ValidationError("State code is required for state schemes.")
    if jurisdiction == "central" and state_code_clean:
        raise ValidationError("Central schemes must not specify a state code.")

    validate_url(source_url, "source_url", required=True)
    validate_url(official_apply_url, "official_apply_url", required=False)
    validate_rules(eligibility_rules)

    if not official_name.strip():
        raise ValidationError("official_name cannot be empty.")
    if not department.strip():
        raise ValidationError("department cannot be empty.")
    if not benefit_summary.strip():
        raise ValidationError("benefit_summary cannot be empty.")

    scheme = Scheme(
        slug=slug_clean,
        official_name=official_name.strip(),
        department=department.strip(),
        jurisdiction=jurisdiction,
        state_code=state_code_clean,
        benefit_summary=benefit_summary.strip(),
        eligibility_rules=eligibility_rules,
        required_documents=[str(d) for d in required_documents],
        official_apply_url=official_apply_url.strip() if official_apply_url else None,
        source_url=source_url.strip(),
        review_status="draft",
        verified_at=None,
        rules_version="1",
    )
    db.add(scheme)
    db.flush()

    audit = AuditEvent(
        actor_admin_id=actor.id,
        action="scheme_created",
        resource_type="scheme",
        resource_id=scheme.id,
        metadata_json={
            "slug": scheme.slug,
            "official_name": scheme.official_name,
            "review_status": "draft",
        },
    )
    db.add(audit)
    db.flush()
    db.refresh(scheme)
    return scheme


def update_scheme(
    db: Session,
    actor: AdminUser,
    scheme_id: str,
    *,
    expected_updated_at: dt.datetime | None,
    slug: str | None = None,
    official_name: str | None = None,
    department: str | None = None,
    jurisdiction: str | None = None,
    state_code: str | None = None,
    benefit_summary: str | None = None,
    eligibility_rules: dict[str, Any] | None = None,
    required_documents: list[str] | None = None,
    official_apply_url: str | None = None,
    source_url: str | None = None,
) -> tuple[Scheme, bool]:
    """Update scheme fields.

    If the scheme was previously 'verified', it is automatically demoted to
    'needs_review' and verified_at is cleared to preserve public integrity.
    If eligibility_rules changed, rules_version is bumped.

    Returns:
        (updated_scheme, verification_invalidated: bool)
    """
    scheme = get_scheme_by_id_or_slug(db, scheme_id)

    # Optimistic concurrency check
    if expected_updated_at is not None:
        exp = (
            expected_updated_at
            if expected_updated_at.tzinfo
            else expected_updated_at.replace(tzinfo=dt.UTC)
        )
        curr = (
            scheme.updated_at
            if scheme.updated_at.tzinfo
            else scheme.updated_at.replace(tzinfo=dt.UTC)
        )
        diff = abs((curr - exp).total_seconds())
        if diff > 1.0:
            raise ConcurrencyConflictError(
                "Scheme was modified by another user. Please reload the latest changes."
            )

    changed_fields: list[str] = []
    verification_invalidated = False

    if slug is not None and slug.strip().lower() != scheme.slug:
        clean_slug = slug.strip().lower()
        if not SLUG_PATTERN.match(clean_slug):
            raise ValidationError("Invalid slug format.")
        existing = db.execute(
            select(Scheme).where(Scheme.slug == clean_slug, Scheme.id != scheme.id)
        ).scalars().first()
        if existing is not None:
            raise ValidationError(f"A scheme with slug '{clean_slug}' already exists.")
        scheme.slug = clean_slug
        changed_fields.append("slug")

    if official_name is not None and official_name.strip() != scheme.official_name:
        if not official_name.strip():
            raise ValidationError("official_name cannot be empty.")
        scheme.official_name = official_name.strip()
        changed_fields.append("official_name")

    if department is not None and department.strip() != scheme.department:
        if not department.strip():
            raise ValidationError("department cannot be empty.")
        scheme.department = department.strip()
        changed_fields.append("department")

    target_jurisdiction = jurisdiction if jurisdiction is not None else scheme.jurisdiction
    if target_jurisdiction not in ("central", "state"):
        raise ValidationError("Jurisdiction must be 'central' or 'state'.")

    if jurisdiction is not None and jurisdiction != scheme.jurisdiction:
        scheme.jurisdiction = jurisdiction
        changed_fields.append("jurisdiction")

    if state_code is not None or jurisdiction is not None:
        target_state = state_code.strip().upper() if state_code else scheme.state_code
        if target_jurisdiction == "state" and not target_state:
            raise ValidationError("State code is required for state schemes.")
        if target_jurisdiction == "central":
            target_state = None
        if target_state != scheme.state_code:
            scheme.state_code = target_state
            changed_fields.append("state_code")

    if benefit_summary is not None and benefit_summary.strip() != scheme.benefit_summary:
        if not benefit_summary.strip():
            raise ValidationError("benefit_summary cannot be empty.")
        scheme.benefit_summary = benefit_summary.strip()
        changed_fields.append("benefit_summary")

    if source_url is not None and source_url.strip() != scheme.source_url:
        validate_url(source_url, "source_url", required=True)
        scheme.source_url = source_url.strip()
        changed_fields.append("source_url")

    if official_apply_url is not None:
        cleaned_apply_url = official_apply_url.strip() if official_apply_url else None
        validate_url(cleaned_apply_url, "official_apply_url", required=False)
        if cleaned_apply_url != scheme.official_apply_url:
            scheme.official_apply_url = cleaned_apply_url
            changed_fields.append("official_apply_url")

    if required_documents is not None:
        docs = [str(d) for d in required_documents]
        if docs != scheme.required_documents:
            scheme.required_documents = docs
            changed_fields.append("required_documents")

    if eligibility_rules is not None and eligibility_rules != scheme.eligibility_rules:
        validate_rules(eligibility_rules)
        scheme.eligibility_rules = eligibility_rules
        changed_fields.append("eligibility_rules")
        # Bump rules_version
        try:
            scheme.rules_version = str(int(scheme.rules_version) + 1)
        except ValueError:
            scheme.rules_version = f"{scheme.rules_version}.1"
        changed_fields.append("rules_version")

    # Invalidate verification if scheme was verified and content changed
    if scheme.review_status == "verified" and changed_fields:
        scheme.review_status = "needs_review"
        scheme.verified_at = None
        verification_invalidated = True
        changed_fields.append("review_status (demoted from verified to needs_review)")

    if changed_fields:
        audit = AuditEvent(
            actor_admin_id=actor.id,
            action="scheme_updated",
            resource_type="scheme",
            resource_id=scheme.id,
            metadata_json={
                "slug": scheme.slug,
                "changed_fields": changed_fields,
                "verification_invalidated": verification_invalidated,
                "review_status": scheme.review_status,
            },
        )
        db.add(audit)
        db.flush()
        db.refresh(scheme)

    return scheme, verification_invalidated


def submit_for_review(db: Session, actor: AdminUser, scheme_id: str) -> Scheme:
    """Submit a draft scheme for reviewer approval (draft -> needs_review)."""
    scheme = get_scheme_by_id_or_slug(db, scheme_id)
    if scheme.review_status not in ("draft", "needs_review"):
        raise InvalidStateTransitionError(
            f"Cannot submit scheme for review from status '{scheme.review_status}'."
        )

    # Validate essential fields are complete
    if not scheme.official_name or not scheme.department or not scheme.benefit_summary:
        raise ValidationError("Cannot submit scheme with incomplete descriptive fields.")
    validate_url(scheme.source_url, "source_url", required=True)
    validate_rules(scheme.eligibility_rules)

    previous_status = scheme.review_status
    scheme.review_status = "needs_review"

    audit = AuditEvent(
        actor_admin_id=actor.id,
        action="review_submitted",
        resource_type="scheme",
        resource_id=scheme.id,
        metadata_json={
            "slug": scheme.slug,
            "previous_status": previous_status,
            "new_status": "needs_review",
        },
    )
    db.add(audit)
    db.flush()
    db.refresh(scheme)
    return scheme


def verify_scheme(db: Session, actor: AdminUser, scheme_id: str) -> Scheme:
    """Approve and verify a scheme (needs_review -> verified). Reviewer/Admin only."""
    scheme = get_scheme_by_id_or_slug(db, scheme_id)
    if scheme.review_status != "needs_review":
        raise InvalidStateTransitionError(
            f"Only schemes in 'needs_review' can be verified (current: '{scheme.review_status}')."
        )

    # Verification checklist against official sources
    if not scheme.source_url or not (
        scheme.source_url.startswith("http://") or scheme.source_url.startswith("https://")
    ):
        raise ValidationError("Cannot verify scheme without a verified official source_url.")

    validate_rules(scheme.eligibility_rules)

    scheme.review_status = "verified"
    scheme.verified_at = dt.datetime.now(dt.UTC)

    audit = AuditEvent(
        actor_admin_id=actor.id,
        action="scheme_verified",
        resource_type="scheme",
        resource_id=scheme.id,
        metadata_json={
            "slug": scheme.slug,
            "verified_by": actor.email,
            "source_url": scheme.source_url,
            "rules_version": scheme.rules_version,
        },
    )
    db.add(audit)
    db.flush()
    db.refresh(scheme)
    return scheme


def request_changes(
    db: Session,
    actor: AdminUser,
    scheme_id: str,
    reason: str,
) -> Scheme:
    """Reject review submission and request changes (needs_review -> draft)."""
    scheme = get_scheme_by_id_or_slug(db, scheme_id)
    if scheme.review_status != "needs_review":
        raise InvalidStateTransitionError(
            f"Cannot request changes for scheme in status '{scheme.review_status}'."
        )

    clean_reason = reason.strip()
    if not clean_reason:
        raise ValidationError("A reason must be provided when requesting changes.")

    scheme.review_status = "draft"
    scheme.verified_at = None

    audit = AuditEvent(
        actor_admin_id=actor.id,
        action="changes_requested",
        resource_type="scheme",
        resource_id=scheme.id,
        metadata_json={
            "slug": scheme.slug,
            "reason": clean_reason,
            "reviewer": actor.email,
        },
    )
    db.add(audit)
    db.flush()
    db.refresh(scheme)
    return scheme


def archive_scheme(db: Session, actor: AdminUser, scheme_id: str) -> Scheme:
    """Archive a scheme without deletion."""
    scheme = get_scheme_by_id_or_slug(db, scheme_id)
    if scheme.review_status == "archived":
        return scheme

    previous_status = scheme.review_status
    scheme.review_status = "archived"

    audit = AuditEvent(
        actor_admin_id=actor.id,
        action="scheme_archived",
        resource_type="scheme",
        resource_id=scheme.id,
        metadata_json={
            "slug": scheme.slug,
            "previous_status": previous_status,
            "new_status": "archived",
        },
    )
    db.add(audit)
    db.flush()
    db.refresh(scheme)
    return scheme


def list_audit_events(
    db: Session,
    *,
    resource_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[tuple[AuditEvent, str | None]], int]:
    """Paginated audit events joined with actor email."""
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    stmt = select(AuditEvent, AdminUser.email).outerjoin(
        AdminUser, AuditEvent.actor_admin_id == AdminUser.id
    )
    count_stmt = select(func.count()).select_from(AuditEvent)

    if resource_id is not None:
        stmt = stmt.where(AuditEvent.resource_id == resource_id)
        count_stmt = count_stmt.where(AuditEvent.resource_id == resource_id)

    total = db.execute(count_stmt).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(AuditEvent.created_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        .all()
    )
    return [(row[0], row[1]) for row in rows], int(total)
