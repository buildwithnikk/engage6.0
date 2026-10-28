"""SQLAlchemy models for Phase 6 Government Source Registry and Import Pipeline."""

from __future__ import annotations

import datetime as dt
from typing import Any
import uuid

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

SOURCE_TYPES = ("portal", "department_site", "gazette_notification", "pdf_guideline")
CANDIDATE_STATUSES = ("pending", "promoted", "rejected")


class GovernmentSource(Base):
    __tablename__ = "government_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    official_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False, default="portal")
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False, default="central")
    state_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_checked_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    candidates: Mapped[list[ImportCandidate]] = relationship(
        "ImportCandidate", back_populates="source", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("jurisdiction in ('central', 'state')", name="sources_jurisdiction_valid"),
        Index("government_sources_active_idx", "is_active"),
        Index("government_sources_jurisdiction_idx", "jurisdiction", "state_code"),
    )


class ImportCandidate(Base):
    __tablename__ = "import_candidates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("government_sources.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    external_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    promoted_scheme_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    source: Mapped[GovernmentSource] = relationship("GovernmentSource", back_populates="candidates")
    promoted_scheme = relationship("Scheme")

    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'promoted', 'rejected')",
            name="import_candidates_status_valid",
        ),
        Index("import_candidates_source_idx", "source_id"),
        Index("import_candidates_status_idx", "status"),
    )
