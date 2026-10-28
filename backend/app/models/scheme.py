"""The `schemes` table, as created by supabase/migrations/20261028120000_create_schemes.sql.

If this model and that migration disagree, the migration is right.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

REVIEW_STATUSES = ("draft", "needs_review", "verified", "archived")
JURISDICTIONS = ("central", "state")

#: The only status a public caller may ever see.
PUBLIC_REVIEW_STATUS = "verified"


class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    official_name: Mapped[str] = mapped_column(Text, nullable=False)
    department: Mapped[str] = mapped_column(Text, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    state_code: Mapped[str | None] = mapped_column(String, nullable=True)
    benefit_summary: Mapped[str] = mapped_column(Text, nullable=False)
    eligibility_rules: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    required_documents: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    official_apply_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    review_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'draft'"))
    verified_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rules_version: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'1'"))

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Maintained by the schemes_set_updated_at trigger, not by the application.
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("jurisdiction in ('central', 'state')", name="schemes_jurisdiction_valid"),
        CheckConstraint(
            "review_status in ('draft', 'needs_review', 'verified', 'archived')",
            name="schemes_review_status_valid",
        ),
        Index("schemes_review_status_idx", "review_status"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Scheme {self.slug} ({self.review_status})>"
