"""Request and response schemas for the eligibility check.

The request carries personal answers. Nothing here is persisted — see
app/api/v1/eligibility.py and docs/privacy.md.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Outcome = Literal["eligible", "ineligible", "needs_more_information"]
ConditionStatus = Literal["met", "failed", "unknown"]

#: Bounds on the answers object. Not security on its own, but it stops an
#: oversized or deeply nested payload from reaching the evaluator.
MAX_ANSWERS = 40
MAX_ANSWER_TEXT = 200

AnswerValue = int | float | bool | str | None


class EligibilityRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "scheme_id": "demo-study-support-allowance",
                    "answers": {
                        "age": 19,
                        "annual_income": 96000,
                        "state_code": "UP",
                        "is_student": True,
                    },
                }
            ]
        },
    )

    scheme_id: str = Field(
        min_length=1,
        max_length=200,
        description="The scheme's UUID or its slug.",
    )
    answers: dict[str, AnswerValue] = Field(
        default_factory=dict,
        max_length=MAX_ANSWERS,
        description=(
            "Facts the citizen supplied, keyed by fact name. Omit anything they "
            "did not answer — a missing answer is treated as unknown, never as a pass."
        ),
    )


class ConditionOutcome(BaseModel):
    fact: str
    type: str
    status: ConditionStatus
    requirement: str
    explanation: str


class EligibilityResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "scheme_id": "00000000-0000-0000-0000-000000000000",
                    "scheme_slug": "demo-study-support-allowance",
                    "official_name": "DEMO — Study Support Allowance (synthetic sample)",
                    "outcome": "needs_more_information",
                    "summary": "We cannot decide yet. 1 question still unanswered.",
                    "met": [],
                    "failed": [],
                    "unknown": [],
                    "missing_facts": ["annual_income"],
                    "rules_version": "1",
                    "source_url": "https://example.gov.in/synthetic-demo-scheme",
                    "review_status": "draft",
                    "evaluated_at": "2026-10-28T12:00:00Z",
                    "disclaimer": "Informational estimate based on recorded rules.",
                }
            ]
        }
    )

    scheme_id: str
    scheme_slug: str
    official_name: str

    outcome: Outcome
    summary: str
    met: list[ConditionOutcome]
    failed: list[ConditionOutcome]
    unknown: list[ConditionOutcome]
    missing_facts: list[str]

    #: Provenance — a result is reproducible only alongside these.
    rules_version: str
    source_url: str
    official_apply_url: str | None = None
    review_status: str
    evaluated_at: str

    disclaimer: str
