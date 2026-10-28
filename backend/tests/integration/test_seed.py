"""The seed: idempotent, and incapable of forging verification."""

import pytest
from sqlalchemy import select, text

from app.models.scheme import Scheme
from app.seed import DEMO_SCHEMES, _assert_synthetic, seed


class TestIdempotency:
    def test_running_twice_creates_no_duplicates(self, db_session):
        created_first, _ = seed(db_session)
        assert created_first == len(DEMO_SCHEMES)

        created_second, updated_second = seed(db_session)
        assert created_second == 0
        assert updated_second == 0

        total = db_session.execute(text("select count(*) from schemes")).scalar_one()
        assert total == len(DEMO_SCHEMES)

    def test_seed_repairs_a_modified_row(self, db_session):
        seed(db_session)
        row = (
            db_session.execute(select(Scheme).where(Scheme.slug == DEMO_SCHEMES[0]["slug"]))
            .scalars()
            .one()
        )
        row.benefit_summary = "tampered"
        db_session.flush()

        _, updated = seed(db_session)
        assert updated == 1
        db_session.refresh(row)
        assert row.benefit_summary == DEMO_SCHEMES[0]["benefit_summary"]


class TestResearchIntegrity:
    """A seed must never claim a provenance nobody established."""

    def test_no_seeded_record_is_verified(self, db_session):
        seed(db_session)
        statuses = {row.review_status for row in db_session.execute(select(Scheme)).scalars().all()}
        assert "verified" not in statuses

    def test_no_seeded_record_has_a_verified_date(self, db_session):
        seed(db_session)
        assert all(
            row.verified_at is None for row in db_session.execute(select(Scheme)).scalars().all()
        )

    def test_guard_rejects_a_verified_record(self):
        record = dict(DEMO_SCHEMES[0], review_status="verified")
        with pytest.raises(ValueError, match="never write review_status='verified'"):
            _assert_synthetic(record)

    def test_guard_rejects_an_unmarked_slug(self):
        record = dict(DEMO_SCHEMES[0], slug="pm-kisan")
        with pytest.raises(ValueError, match="must start with 'demo-'"):
            _assert_synthetic(record)

    def test_guard_rejects_an_unmarked_name(self):
        record = dict(DEMO_SCHEMES[0], official_name="Pradhan Mantri Awas Yojana")
        with pytest.raises(ValueError, match="must be marked DEMO"):
            _assert_synthetic(record)

    def test_every_shipped_record_passes_its_own_guard(self):
        for record in DEMO_SCHEMES:
            _assert_synthetic(record)

    def test_seeded_records_are_invisible_to_the_public_api(self, client, db_session):
        """Unverified by construction, therefore hidden by policy."""
        seed(db_session)
        body = client.get("/api/v1/schemes").json()
        assert body["total"] == 0
