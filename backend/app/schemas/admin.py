"""Pydantic schemas for the Phase 2 admin interface and API.

Mirrored by frontend/src/types/api.ts — change both in the same commit.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.scheme import Jurisdiction, ReviewStatus

AdminRole = Literal["admin", "reviewer", "editor"]


class AdminUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: AdminRole
    is_active: bool
    created_at: dt.datetime
    last_login_at: dt.datetime | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class LoginResponse(BaseModel):
    user: AdminUserSummary
    csrf_token: str


class MeResponse(BaseModel):
    user: AdminUserSummary
    csrf_token: str


class AdminOverviewResponse(BaseModel):
    total: int
    draft: int
    needs_review: int
    verified: int
    archived: int


class AdminSchemeSummary(BaseModel):
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
    created_at: dt.datetime
    updated_at: dt.datetime


class AdminSchemeDetail(AdminSchemeSummary):
    eligibility_rules: dict[str, Any]


class AdminSchemeListResponse(BaseModel):
    items: list[AdminSchemeSummary]
    total: int
    page: int
    page_size: int


class AdminSchemeCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=100)
    official_name: str = Field(min_length=2, max_length=300)
    department: str = Field(min_length=2, max_length=200)
    jurisdiction: Jurisdiction
    state_code: str | None = None
    benefit_summary: str = Field(min_length=5, max_length=2000)
    eligibility_rules: dict[str, Any]
    required_documents: list[str] = Field(default_factory=list)
    official_apply_url: str | None = None
    source_url: str = Field(min_length=5, max_length=1000)


class AdminSchemeUpdate(BaseModel):
    expected_updated_at: dt.datetime | None = None
    slug: str | None = None
    official_name: str | None = None
    department: str | None = None
    jurisdiction: Jurisdiction | None = None
    state_code: str | None = None
    benefit_summary: str | None = None
    eligibility_rules: dict[str, Any] | None = None
    required_documents: list[str] | None = None
    official_apply_url: str | None = None
    source_url: str | None = None


class RequestChangesRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class AuditEventSummary(BaseModel):
    id: uuid.UUID
    actor_admin_id: uuid.UUID | None
    actor_email: str | None = None
    action: str
    resource_type: str
    resource_id: uuid.UUID | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: dt.datetime


class AuditEventsResponse(BaseModel):
    items: list[AuditEventSummary]
    total: int
    page: int
    page_size: int
