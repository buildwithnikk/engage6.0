"""Idempotent seed of SYNTHETIC demo schemes.

Run:  ./scripts/db.sh seed       (or: python -m app.seed)

Every record here is INVENTED. Names begin with "DEMO —", slugs begin with
"demo-", departments are fictional, and source URLs point at example.gov.in,
which is not a real site.

Two rules this file must never break:

1. **Nothing is seeded as `verified`.** Verification means a named person read
   the responsible department's official page on a recorded date. No script can
   do that, so a seed that wrote `verified` would be forging a provenance claim —
   and the database constraint `schemes_verified_requires_date` is a second line
   of defence, not the first.
2. **No real citizen data**, and no real scheme's criteria copied in and left
   unverified where it could be mistaken for checked fact.

Real schemes enter the catalogue through docs/research-register.md, not here.

Because nothing here is verified, these rows are invisible to the public API by
default. To see them while developing, set ALLOW_UNVERIFIED_SCHEMES=true.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_sessionmaker
from app.models.scheme import Scheme

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("seed")

SYNTHETIC_SOURCE = "https://example.gov.in/synthetic-demo-scheme"

DEMO_SCHEMES: list[dict[str, Any]] = [
    {
        "slug": "demo-study-support-allowance",
        "official_name": "DEMO — Study Support Allowance (synthetic sample)",
        "department": "Demo Department of Education (fictional)",
        "jurisdiction": "state",
        "state_code": "UP",
        "benefit_summary": (
            "SYNTHETIC DEMO RECORD. Illustrative only — a monthly allowance for "
            "students from low-income households. Not a real scheme."
        ),
        "eligibility_rules": {
            "version": "1",
            "all": [
                {"type": "age_min", "fact": "age", "value": 16},
                {"type": "age_max", "fact": "age", "value": 25},
                {"type": "income_max", "fact": "annual_income", "value": 250000},
                {"type": "state_in", "fact": "state_code", "values": ["UP"]},
                {
                    "type": "is_true",
                    "fact": "is_student",
                    "label": "Must currently be enrolled as a student",
                },
            ],
        },
        "required_documents": [
            "Identity proof (demo)",
            "Income certificate (demo)",
            "Proof of enrolment (demo)",
        ],
        "official_apply_url": None,
        "source_url": SYNTHETIC_SOURCE,
        "review_status": "draft",
        "rules_version": "1",
    },
    {
        "slug": "demo-artisan-equipment-grant",
        "official_name": "DEMO — Artisan Equipment Grant (synthetic sample)",
        "department": "Demo Ministry of Rural Livelihoods (fictional)",
        "jurisdiction": "central",
        "state_code": None,
        "benefit_summary": (
            "SYNTHETIC DEMO RECORD. Illustrative only — a one-time grant towards "
            "tools for registered artisans. Not a real scheme."
        ),
        "eligibility_rules": {
            "version": "1",
            "all": [
                {"type": "age_min", "fact": "age", "value": 18},
                {"type": "income_max", "fact": "annual_income", "value": 400000},
                {
                    "type": "category_in",
                    "fact": "occupation",
                    "values": ["artisan", "weaver", "potter"],
                    "label": "Must work in a listed craft occupation",
                },
            ],
        },
        "required_documents": ["Identity proof (demo)", "Artisan registration (demo)"],
        "official_apply_url": None,
        "source_url": SYNTHETIC_SOURCE,
        "review_status": "draft",
        "rules_version": "1",
    },
    {
        "slug": "demo-senior-travel-concession",
        "official_name": "DEMO — Senior Travel Concession (synthetic sample)",
        "department": "Demo State Transport Authority (fictional)",
        "jurisdiction": "state",
        "state_code": "UP",
        "benefit_summary": (
            "SYNTHETIC DEMO RECORD. Illustrative only — a travel concession for "
            "senior residents. Not a real scheme."
        ),
        "eligibility_rules": {
            "version": "1",
            "all": [
                {"type": "age_min", "fact": "age", "value": 60},
                {"type": "state_in", "fact": "state_code", "values": ["UP"]},
            ],
        },
        "required_documents": ["Age proof (demo)", "Residence proof (demo)"],
        "official_apply_url": None,
        "source_url": SYNTHETIC_SOURCE,
        "review_status": "needs_review",
        "rules_version": "1",
    },
    {
        "slug": "demo-unreadable-rules-fixture",
        "official_name": "DEMO — Scheme With Unsupported Rules (synthetic sample)",
        "department": "Demo Department of Examples (fictional)",
        "jurisdiction": "central",
        "state_code": None,
        "benefit_summary": (
            "SYNTHETIC DEMO RECORD. Exists to exercise the failure path: its rules "
            "use a predicate this build does not implement, so an eligibility check "
            "must answer 'needs more information' rather than guessing."
        ),
        "eligibility_rules": {
            "version": "1",
            "all": [{"type": "lunar_phase_in", "fact": "lunar_phase", "values": ["waxing"]}],
        },
        "required_documents": [],
        "official_apply_url": None,
        "source_url": SYNTHETIC_SOURCE,
        "review_status": "draft",
        "rules_version": "1",
    },
]


def _assert_synthetic(record: dict[str, Any]) -> None:
    """Guardrails, enforced at runtime rather than trusted to review."""
    if record["review_status"] == "verified":
        raise ValueError(
            f"{record['slug']}: a seed must never write review_status='verified'. "
            "Verification requires a person and a source; see docs/research-register.md."
        )
    if not record["slug"].startswith("demo-"):
        raise ValueError(f"{record['slug']}: seeded slugs must start with 'demo-'.")
    if "DEMO" not in record["official_name"]:
        raise ValueError(f"{record['slug']}: seeded names must be marked DEMO.")


def seed(session: Session) -> tuple[int, int]:
    """Insert or update the demo records. Returns (created, updated).

    Idempotent: keyed on slug, so running it repeatedly converges on the same
    rows instead of duplicating them.
    """
    created = updated = 0

    for record in DEMO_SCHEMES:
        _assert_synthetic(record)

        existing = (
            session.execute(select(Scheme).where(Scheme.slug == record["slug"])).scalars().first()
        )

        if existing is None:
            session.add(Scheme(**record))
            created += 1
            logger.info("created %s", record["slug"])
        else:
            changed = False
            for key, value in record.items():
                if getattr(existing, key) != value:
                    setattr(existing, key, value)
                    changed = True
            if changed:
                updated += 1
                logger.info("updated %s", record["slug"])

    session.commit()
    return created, updated


def main() -> None:
    session = get_sessionmaker()()
    try:
        created, updated = seed(session)
    finally:
        session.close()

    total = len(DEMO_SCHEMES)
    logger.info(
        "seed: %d created, %d updated, %d unchanged",
        created,
        updated,
        total - created - updated,
    )
    logger.info(
        "All seeded records are SYNTHETIC and not verified, so the public API hides "
        "them. Set ALLOW_UNVERIFIED_SCHEMES=true in backend/.env to see them while "
        "developing."
    )


if __name__ == "__main__":
    main()
