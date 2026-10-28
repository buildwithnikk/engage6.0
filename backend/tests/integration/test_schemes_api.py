"""Scheme endpoints against a real PostgreSQL database.

Every test runs in a transaction that is rolled back, so these never touch the
development catalogue and never depend on each other's rows.
"""

import datetime as dt

import pytest

from tests.factories import make_scheme


@pytest.fixture
def verified(db_session):
    scheme = make_scheme(slug="test-verified-one", official_name="TEST — Verified One")
    db_session.add(scheme)
    db_session.flush()
    return scheme


@pytest.fixture
def draft(db_session):
    scheme = make_scheme(slug="test-draft-one", review_status="draft")
    db_session.add(scheme)
    db_session.flush()
    return scheme


class TestVisibility:
    """The rule the whole phase is built around: public means verified."""

    def test_list_includes_verified(self, client, verified):
        body = client.get("/api/v1/schemes").json()
        assert verified.slug in [item["slug"] for item in body["items"]]

    def test_list_excludes_draft(self, client, draft, verified):
        body = client.get("/api/v1/schemes").json()
        slugs = [item["slug"] for item in body["items"]]
        assert draft.slug not in slugs
        assert verified.slug in slugs

    def test_review_status_filter_cannot_widen_visibility(self, client, draft):
        """Asking for drafts without permission returns nothing, not a draft."""
        body = client.get("/api/v1/schemes", params={"review_status": "draft"}).json()
        assert body["total"] == 0
        assert body["items"] == []

    def test_detail_of_draft_is_404_not_403(self, client, draft):
        """403 would confirm the record exists. 404 reveals nothing."""
        res = client.get(f"/api/v1/schemes/{draft.slug}")
        assert res.status_code == 404

    def test_detail_by_uuid_of_draft_is_also_404(self, client, draft):
        assert client.get(f"/api/v1/schemes/{draft.id}").status_code == 404

    def test_archived_is_not_public(self, client, db_session):
        scheme = make_scheme(slug="test-archived", review_status="archived")
        db_session.add(scheme)
        db_session.flush()
        body = client.get("/api/v1/schemes").json()
        assert scheme.slug not in [i["slug"] for i in body["items"]]


class TestDetail:
    def test_lookup_by_slug(self, client, verified):
        body = client.get(f"/api/v1/schemes/{verified.slug}").json()
        assert body["slug"] == verified.slug
        assert body["official_name"] == verified.official_name

    def test_lookup_by_uuid(self, client, verified):
        body = client.get(f"/api/v1/schemes/{verified.id}").json()
        assert body["slug"] == verified.slug

    def test_unknown_reference_is_404(self, client):
        assert client.get("/api/v1/schemes/no-such-scheme").status_code == 404
        assert client.get("/api/v1/schemes/0e37df36-f698-11e6-8dd4-cb9ced3df976").status_code == 404

    def test_detail_exposes_questionnaire_not_rules(self, client, verified):
        body = client.get(f"/api/v1/schemes/{verified.slug}").json()
        assert "eligibility_rules" not in body
        assert body["rules_readable"] is True
        assert {f["fact"] for f in body["required_facts"]} == {"age", "annual_income"}

    def test_unreadable_rules_are_flagged_not_hidden(self, client, db_session):
        scheme = make_scheme(
            slug="test-unreadable",
            eligibility_rules={"version": "1", "all": [{"type": "nope", "fact": "x"}]},
        )
        db_session.add(scheme)
        db_session.flush()
        body = client.get(f"/api/v1/schemes/{scheme.slug}").json()
        assert body["rules_readable"] is False
        assert body["required_facts"] == []


class TestFilters:
    def test_text_search_matches_name(self, client, db_session):
        db_session.add(make_scheme(slug="test-widget", official_name="TEST — Widget Grant"))
        db_session.add(make_scheme(slug="test-other", official_name="TEST — Something Else"))
        db_session.flush()
        body = client.get("/api/v1/schemes", params={"q": "Widget"}).json()
        assert [i["slug"] for i in body["items"]] == ["test-widget"]

    def test_text_search_wildcards_are_escaped(self, client, verified):
        """A literal % must search for a percent sign, not match everything."""
        body = client.get("/api/v1/schemes", params={"q": "%"}).json()
        assert body["total"] == 0

    def test_jurisdiction_filter(self, client, db_session):
        db_session.add(make_scheme(slug="test-central", jurisdiction="central"))
        db_session.add(make_scheme(slug="test-state", jurisdiction="state", state_code="UP"))
        db_session.flush()
        body = client.get("/api/v1/schemes", params={"jurisdiction": "state"}).json()
        assert [i["slug"] for i in body["items"]] == ["test-state"]

    def test_state_filter_also_returns_central_schemes(self, client, db_session):
        """A citizen in UP qualifies for central schemes too; hiding them would mislead."""
        db_session.add(make_scheme(slug="test-c", jurisdiction="central"))
        db_session.add(make_scheme(slug="test-up", jurisdiction="state", state_code="UP"))
        db_session.add(make_scheme(slug="test-br", jurisdiction="state", state_code="BR"))
        db_session.flush()
        slugs = {
            i["slug"]
            for i in client.get("/api/v1/schemes", params={"state_code": "UP"}).json()["items"]
        }
        assert "test-up" in slugs and "test-c" in slugs and "test-br" not in slugs

    def test_state_filter_is_case_insensitive(self, client, db_session):
        db_session.add(make_scheme(slug="test-up2", jurisdiction="state", state_code="UP"))
        db_session.flush()
        body = client.get("/api/v1/schemes", params={"state_code": "up"}).json()
        assert "test-up2" in [i["slug"] for i in body["items"]]

    def test_invalid_jurisdiction_is_rejected(self, client):
        assert client.get("/api/v1/schemes", params={"jurisdiction": "galactic"}).status_code == 422


class TestPagination:
    @pytest.fixture
    def many(self, db_session):
        for i in range(7):
            db_session.add(make_scheme(slug=f"test-page-{i:02d}", official_name=f"TEST — {i:02d}"))
        db_session.flush()

    def test_page_size_limits_results_but_not_total(self, client, many):
        body = client.get("/api/v1/schemes", params={"page_size": 3}).json()
        assert len(body["items"]) == 3
        assert body["total"] >= 7
        assert body["page"] == 1 and body["page_size"] == 3

    def test_pages_do_not_overlap(self, client, many):
        p1 = client.get("/api/v1/schemes", params={"page_size": 3, "page": 1}).json()
        p2 = client.get("/api/v1/schemes", params={"page_size": 3, "page": 2}).json()
        assert set(i["id"] for i in p1["items"]).isdisjoint(i["id"] for i in p2["items"])

    def test_page_beyond_the_end_is_empty_not_an_error(self, client, many):
        body = client.get("/api/v1/schemes", params={"page": 999}).json()
        assert body["items"] == []

    @pytest.mark.parametrize(
        "params", [{"page": 0}, {"page": -1}, {"page_size": 0}, {"page_size": 101}]
    )
    def test_out_of_bounds_paging_is_rejected(self, client, params):
        assert client.get("/api/v1/schemes", params=params).status_code == 422

    def test_ordering_is_stable_across_requests(self, client, many):
        first = [i["id"] for i in client.get("/api/v1/schemes").json()["items"]]
        for _ in range(3):
            assert [i["id"] for i in client.get("/api/v1/schemes").json()["items"]] == first


class TestPhaseBoundary:
    def test_later_phase_endpoints_are_not_registered(self, client):
        """Guards against silently starting future phases."""
        for path in ("/api/v1/complaints", "/api/v1/profiles", "/api/v1/auth"):
            assert client.get(path).status_code == 404


class TestModelConstraints:
    def test_verified_requires_a_date(self, db_session):
        """The database refuses a verification claim with no date behind it."""
        from sqlalchemy.exc import IntegrityError

        scheme = make_scheme(slug="test-bad-verified")
        scheme.verified_at = None
        db_session.add(scheme)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_updated_at_is_maintained_by_the_database(self, db_session, verified):
        original = verified.updated_at
        verified.benefit_summary = "changed by test"
        db_session.flush()
        db_session.refresh(verified)
        assert verified.updated_at > original

    def test_slug_is_unique(self, db_session):
        from sqlalchemy.exc import IntegrityError

        db_session.add(make_scheme(slug="test-duplicate"))
        db_session.flush()
        db_session.add(make_scheme(slug="test-duplicate"))
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_created_at_is_timezone_aware(self, verified):
        assert verified.created_at.tzinfo is not None
        assert isinstance(verified.created_at, dt.datetime)
