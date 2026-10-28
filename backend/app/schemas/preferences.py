"""Pydantic schemas for Phase 5 preferences and locale registry."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

AreaType = Literal["rural", "urban", "skip"]


class UserPreferences(BaseModel):
    language: str = Field(default="en", description="Supported language code (en or hi)")
    state_code: str | None = Field(default=None, description="ISO State code (e.g. UP, DL)")
    district: str | None = Field(default=None, description="District within the selected state")
    area_type: AreaType = Field(default="skip", description="rural, urban, or skip")


class UpdatePreferencesRequest(BaseModel):
    language: str | None = None
    state_code: str | None = None
    district: str | None = None
    area_type: AreaType | None = None


class PreferencesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    preferences: UserPreferences
    has_set_preferences: bool
    csrf_token: str | None = None


class StateItem(BaseModel):
    code: str
    name: str
    name_hi: str
    districts: list[str]


class LocaleItem(BaseModel):
    code: str
    name: str
    native_name: str
    is_supported: bool


class LocationMetadataResponse(BaseModel):
    states: list[StateItem]
    locales: list[LocaleItem]
