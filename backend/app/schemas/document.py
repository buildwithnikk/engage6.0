"""Pydantic schemas for Phase 3 document upload, extraction, and confirmation."""

from __future__ import annotations

import datetime as dt
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field


class DocumentSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: uuid.UUID
    csrf_token: str
    expires_at: dt.datetime
    max_file_size: int
    allowed_media_types: list[str]
    max_pages: int
    max_active_documents: int


class DocumentUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    media_type: str
    file_size: int
    page_count: int
    expires_at: dt.datetime
    created_at: dt.datetime


class DocumentStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    media_type: str
    file_size: int
    page_count: int
    expires_at: dt.datetime
    created_at: dt.datetime
    error_code: str | None = None
    warnings: list[str] = Field(default_factory=list)


class ExtractionCandidate(BaseModel):
    field: str
    value: Any
    raw_text: str
    page: int
    method: str
    confidence: float | None = None


class PageTextItem(BaseModel):
    page: int
    text: str
    method: str


class DocumentExtractionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: uuid.UUID
    status: str
    extractor_version: str
    pages: list[PageTextItem] = Field(default_factory=list)
    candidates: list[ExtractionCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confirmed_answers: dict[str, Any] = Field(default_factory=dict)


AnswerValue = int | float | bool | str | None


class ConfirmAnswersRequest(BaseModel):
    answers: dict[str, AnswerValue] = Field(
        default_factory=dict,
        max_length=40,
        description="Explicit user-confirmed answers to populate the questionnaire.",
    )


class ConfirmAnswersResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: uuid.UUID
    confirmed_answers: dict[str, Any]
    status: str
