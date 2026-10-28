"""Synthetic test data.

Everything here is invented. No real scheme, no real citizen, no real URL.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from app.models.scheme import Scheme

TEST_SOURCE = "https://example.test/synthetic"


def make_scheme(**overrides: Any) -> Scheme:
    """A verified central scheme with simple rules, unless overridden."""
    slug = overrides.pop("slug", f"test-scheme-{uuid.uuid4().hex[:8]}")
    base: dict[str, Any] = {
        "slug": slug,
        "official_name": f"TEST — {slug}",
        "department": "Test Department (fictional)",
        "jurisdiction": "central",
        "state_code": None,
        "benefit_summary": "Synthetic test record.",
        "eligibility_rules": {
            "version": "1",
            "all": [
                {"type": "age_min", "fact": "age", "value": 18},
                {"type": "income_max", "fact": "annual_income", "value": 250000},
            ],
        },
        "required_documents": ["Test document"],
        "official_apply_url": None,
        "source_url": TEST_SOURCE,
        "review_status": "verified",
        "verified_at": dt.datetime(2026, 1, 1, tzinfo=dt.UTC),
        "rules_version": "1",
    }
    base.update(overrides)

    # Keep the factory honest about the database's own rule.
    if base["review_status"] != "verified":
        base["verified_at"] = None

    return Scheme(**base)
