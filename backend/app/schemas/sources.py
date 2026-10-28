"""Pydantic schemas for Phase 6 Government Sources and Import Candidates."""

from __future__ import annotations

import datetime as dt
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field


class GovernmentSourceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    official_url: str = Field(min_length=5, max_length=500)
    source_type: str = Field(default="portal")
    jurisdiction: str = Field(pattern="^(central|state)$")
    state_code: str | None = None
    notes: str | None = None


class GovernmentSourceDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    official_url: str
    source_type: str
    jurisdiction: str
    state_code: str | None
    last_checked_at: dt.datetime | None
    notes: str | None
    is_active: bool
    created_at: dt.datetime
    updated_at: dt.datetime


class GovernmentSourceListResponse(BaseModel):
    items: list[GovernmentSourceDetail]
    total: int


class ImportCandidateDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_id: uuid.UUID
    source_url: str
    external_reference: str | None
    extracted_data: dict[str, Any]
    status: str
    promoted_scheme_id: uuid.UUID | None
    review_notes: str | None
    created_at: dt.datetime
    updated_at: dt.datetime


class ImportCandidateListResponse(BaseModel):
    items: list[ImportCandidateDetail]
    total: int


class TriggerImportRequest(BaseModel):
    source_key: str = Field(description="Adapter source key, e.g. 'nsp_central' or 'haryana_saral'")


class PromoteCandidateResponse(BaseModel):
    candidate_id: uuid.UUID
    scheme_id: uuid.UUID
    scheme_slug: str
    review_status: str
