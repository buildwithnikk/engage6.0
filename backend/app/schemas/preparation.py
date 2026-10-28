"""Pydantic schemas for Phase 4 assisted application preparation."""

from __future__ import annotations

import datetime as dt
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field

AnswerValue = int | float | bool | str | None


class PreparationDraftCreateRequest(BaseModel):
    scheme_id: str = Field(..., description="Scheme UUID or slug")
    answers: dict[str, AnswerValue] = Field(default_factory=dict)
    checklist_state: dict[str, bool] = Field(default_factory=dict)


class PreparationDraftUpdateRequest(BaseModel):
    answers: dict[str, AnswerValue] | None = None
    checklist_state: dict[str, bool] | None = None


class ConditionSummary(BaseModel):
    fact: str
    requirement: str
    explanation: str
    status: str


class EligibilitySummary(BaseModel):
    outcome: str
    summary: str
    missing_fields: list[str] = Field(default_factory=list)
    met: list[ConditionSummary] = Field(default_factory=list)
    failed: list[ConditionSummary] = Field(default_factory=list)
    unknown: list[ConditionSummary] = Field(default_factory=list)


class PreparationDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scheme_id: uuid.UUID
    scheme_slug: str
    scheme_name: str
    department: str
    official_apply_url: str | None
    source_url: str
    required_documents: list[dict[str, Any]]
    answers: dict[str, AnswerValue]
    checklist_state: dict[str, bool]
    eligibility_summary: EligibilitySummary
    disclaimer: str = (
        "This is not an official application or submission. Sahayak assists only with preparing your "
        "information and verifying document readiness before you apply on the official government portal."
    )
    expires_at: dt.datetime
    updated_at: dt.datetime
