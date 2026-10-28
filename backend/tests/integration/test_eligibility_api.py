"""The eligibility endpoint against a real database.

The behaviour these tests protect: a result is explained, reproducible, and
never stored.
"""

import datetime as dt

import pytest
from sqlalchemy import text

from tests.factories import make_scheme

RULES = {
    "version": "1",
    "all": [
        {"type": "age_min", "fact": "age", "value": 18},
        {"type": "income_max", "fact": "annual_income", "value": 250000},
        {"type": "state_in", "fact": "state_code", "values": ["UP"]},
    ],
}


@pytest.fixture
def scheme(db_session):
    row = make_scheme(slug="test-eligibility", eligibility_rules=RULES)
    db_session.add(row)
    db_session.flush()
    return row


def check(client, scheme_ref, answers):
    return client.post(
        "/api/v1/eligibility/check",
        json={"scheme_id": scheme_ref, "answers": answers},
    )


class TestOutcomes:
    def test_eligible(self, client, scheme):
        body = check(
            client, scheme.slug, {"age": 19, "annual_income": 96000, "state_code": "UP"}
        ).json()
        assert body["outcome"] == "eligible"
        assert len(body["met"]) == 3
        assert body["failed"] == [] and body["unknown"] == []

    def test_ineligible_names_the_failing_requirement(self, client, scheme):
        body = check(
            client, scheme.slug, {"age": 19, "annual_income": 900000, "state_code": "UP"}
        ).json()
        assert body["outcome"] == "ineligible"
        assert [f["fact"] for f in body["failed"]] == ["annual_income"]
        assert "900,000" in body["failed"][0]["explanation"]

    def test_missing_answers_give_needs_more_information(self, client, scheme):
        body = check(client, scheme.slug, {"age": 19}).json()
        assert body["outcome"] == "needs_more_information"
        assert set(body["missing_facts"]) == {"annual_income", "state_code"}

    def test_empty_answers_are_never_eligible(self, client, scheme):
        assert check(client, scheme.slug, {}).json()["outcome"] == "needs_more_information"

    def test_unsupported_rules_are_never_eligible(self, client, db_session):
        row = make_scheme(
            slug="test-unsupported-rules",
            eligibility_rules={"version": "1", "all": [{"type": "lunar_phase_in", "fact": "p"}]},
        )
        db_session.add(row)
        db_session.flush()
        body = check(client, row.slug, {"p": "waxing"}).json()
        assert body["outcome"] == "needs_more_information"
        assert "lunar_phase_in" in body["summary"]

    def test_lookup_by_uuid_works_too(self, client, scheme):
        body = check(
            client, str(scheme.id), {"age": 19, "annual_income": 96000, "state_code": "UP"}
        ).json()
        assert body["outcome"] == "eligible"


class TestProvenance:
    def test_result_carries_rules_version_and_source(self, client, scheme):
        body = check(client, scheme.slug, {"age": 19}).json()
        assert body["rules_version"] == scheme.rules_version
        assert body["source_url"] == scheme.source_url
        assert body["review_status"] == "verified"
        # evaluated_at must parse as a real timestamp
        assert dt.datetime.fromisoformat(body["evaluated_at"])

    def test_every_result_carries_a_disclaimer(self, client, scheme):
        body = check(
            client, scheme.slug, {"age": 19, "annual_income": 1, "state_code": "UP"}
        ).json()
        assert "not an official decision" in body["disclaimer"].lower()

    def test_results_are_reproducible(self, client, scheme):
        answers = {"age": 19, "annual_income": 96000, "state_code": "UP"}
        first = check(client, scheme.slug, answers).json()
        for _ in range(3):
            again = check(client, scheme.slug, answers).json()
            assert again["outcome"] == first["outcome"]
            assert again["met"] == first["met"]


class TestVisibility:
    def test_unverified_scheme_is_404(self, client, db_session):
        row = make_scheme(slug="test-draft-eligibility", review_status="draft")
        db_session.add(row)
        db_session.flush()
        assert check(client, row.slug, {"age": 19}).status_code == 404

    def test_unknown_scheme_is_404(self, client):
        assert check(client, "no-such-scheme", {"age": 19}).status_code == 404


class TestValidation:
    def test_missing_scheme_id_is_422(self, client):
        assert client.post("/api/v1/eligibility/check", json={"answers": {}}).status_code == 422

    def test_unknown_top_level_field_is_rejected(self, client, scheme):
        res = client.post(
            "/api/v1/eligibility/check",
            json={"scheme_id": scheme.slug, "answers": {}, "store_my_answers": True},
        )
        assert res.status_code == 422

    def test_answers_must_be_an_object(self, client, scheme):
        res = client.post(
            "/api/v1/eligibility/check",
            json={"scheme_id": scheme.slug, "answers": ["age", 19]},
        )
        assert res.status_code == 422

    def test_nested_answer_values_are_rejected(self, client, scheme):
        res = client.post(
            "/api/v1/eligibility/check",
            json={"scheme_id": scheme.slug, "answers": {"age": {"nested": 1}}},
        )
        assert res.status_code == 422

    def test_empty_scheme_id_is_422(self, client):
        res = client.post("/api/v1/eligibility/check", json={"scheme_id": "", "answers": {}})
        assert res.status_code == 422

    def test_body_must_be_json(self, client):
        assert client.post("/api/v1/eligibility/check", content="not json").status_code == 422


class TestStatelessness:
    """docs/privacy.md: the first MVP must not retain personal answers."""

    def test_checking_eligibility_writes_no_rows(self, client, scheme, db_session):
        before = db_session.execute(text("select count(*) from schemes")).scalar_one()

        check(
            client,
            scheme.slug,
            {"age": 19, "annual_income": 96000, "state_code": "UP"},
        )

        after = db_session.execute(text("select count(*) from schemes")).scalar_one()
        assert after == before

    def test_no_table_exists_that_could_hold_answers(self, db_session):
        """A stateless promise is only credible if there is nowhere to store them."""
        tables = {
            row[0]
            for row in db_session.execute(
                text("select tablename from pg_tables where schemaname = 'public'")
            )
        }
        # In Phase 6, government_sources and import_candidates exist for source curation,
        # but no persistent citizen profiles or citizen accounts exist.
        assert tables == {
            "schemes",
            "admin_users",
            "admin_sessions",
            "audit_events",
            "document_sessions",
            "documents",
            "document_extractions",
            "document_jobs",
            "preparation_drafts",
            "government_sources",
            "import_candidates",
        }

    def test_the_scheme_row_is_not_mutated_by_a_check(self, client, scheme, db_session):
        before = scheme.updated_at
        check(client, scheme.slug, {"age": 19, "annual_income": 96000, "state_code": "UP"})
        db_session.refresh(scheme)
        assert scheme.updated_at == before
