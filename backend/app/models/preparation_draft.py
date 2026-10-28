"""SQLAlchemy model for Phase 4 application preparation drafts."""

from __future__ import annotations

import datetime as dt
from typing import Any
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PreparationDraft(Base):
    __tablename__ = "preparation_drafts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    scheme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="CASCADE"),
        nullable=False,
    )
    answers: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    checklist_state: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session = relationship("DocumentSession")
    scheme = relationship("Scheme")

    __table_args__ = (
        CheckConstraint(
            "coalesce(jsonb_typeof(answers), '') = 'object'",
            name="preparation_drafts_answers_is_object",
        ),
        CheckConstraint(
            "coalesce(jsonb_typeof(checklist_state), '') = 'object'",
            name="preparation_drafts_checklist_is_object",
        ),
        Index("preparation_drafts_session_idx", "session_id"),
        Index("preparation_drafts_scheme_idx", "scheme_id"),
        Index("preparation_drafts_expires_at_idx", "expires_at"),
    )
