"""Pydantic schemas for the scheme catalogue.

Mirrored by frontend/src/types/api.ts — change both in the same commit.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ReviewStatus = Literal["draft", "needs_review", "verified", "archived"]
Jurisdiction = Literal["central", "state"]


class SchemeSummary(BaseModel):
    """List representation.

    `eligibility_rules` is deliberately absent: rules are an implementation
    detail of the evaluator, and publishing them invites clients to reimplement
    eligibility and then disagree with us.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    official_name: str
    department: str
    jurisdiction: Jurisdiction
    state_code: str | None
    benefit_summary: str
    required_documents: list[str]
    official_apply_url: str | None
    source_url: str
    review_status: ReviewStatus
    verified_at: dt.datetime | None
    rules_version: str

    @field_validator("required_documents", mode="before")
    @classmethod
    def _coerce_documents(cls, v: Any) -> list[str]:
        # JSONB can hold anything the constraint allows; keep the API shape stable.
        if isinstance(v, list):
            return [str(item) for item in v]
        return []


class FactRequirement(BaseModel):
    """One question the questionnaire must ask, derived from the rules."""

    fact: str
    kind: Literal["integer", "boolean", "choice", "text"]
    requirements: list[str]
    choices: list[str] = Field(default_factory=list)


class SchemeDetail(SchemeSummary):
    """Detail representation: adds the questionnaire shape, still not the rules."""

    required_facts: list[FactRequirement] = Field(default_factory=list)
    rules_readable: bool = Field(
        description=(
            "False when this build cannot parse the stored rules. The eligibility "
            "check then returns needs_more_information rather than guessing."
        )
    )


class SchemeListResponse(BaseModel):
    items: list[SchemeSummary]
    total: int
    page: int
    page_size: int

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "items": [],
                    "total": 0,
                    "page": 1,
                    "page_size": 20,
                }
            ]
        }
    )
