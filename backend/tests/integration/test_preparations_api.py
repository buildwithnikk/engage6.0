"""Integration tests for Phase 4 assisted application preparation drafts."""

import pytest

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
def verified_scheme(db_session):
    scheme = make_scheme(
        slug="study-support-verified",
        official_name="Study Support Allowance",
        department="Higher Education",
        eligibility_rules=RULES,
        required_documents=[
            {"id": "income_cert", "name": "Income Certificate", "mandatory": True},
            {"id": "aadhaar", "name": "Aadhaar Card", "mandatory": True},
        ],
        official_apply_url="https://portal.example.gov.in/apply/study-support",
        source_url="https://education.example.gov.in/schemes/study-support",
        review_status="verified",
    )
    db_session.add(scheme)
    db_session.flush()
    return scheme


@pytest.fixture
def draft_scheme(db_session):
    scheme = make_scheme(
        slug="unverified-scheme",
        official_name="Unverified Scheme",
        department="Test Dept",
        eligibility_rules=RULES,
        review_status="draft",
        verified_at=None,
    )
    db_session.add(scheme)
    db_session.flush()
    return scheme


def test_create_preparation_draft_and_read_summary(client, verified_scheme):
    # 1. Create a draft without prior session
    res = client.post(
        "/api/v1/preparations",
        json={"scheme_id": verified_scheme.slug, "answers": {"age": 20}},
    )
    assert res.status_code == 201
    body = res.json()

    assert body["scheme_slug"] == verified_scheme.slug
    assert body["scheme_name"] == "Study Support Allowance"
    assert body["official_apply_url"] == "https://portal.example.gov.in/apply/study-support"
    assert "not an official application" in body["disclaimer"].lower()
    assert body["answers"] == {"age": 20}
    assert len(body["required_documents"]) == 2
    assert body["eligibility_summary"]["outcome"] == "needs_more_information"
    assert "annual_income" in body["eligibility_summary"]["missing_fields"]

    draft_id = body["id"]
    csrf_token = res.headers.get("X-CSRF-Token")

    # 2. Get the draft by ID
    get_res = client.get(f"/api/v1/preparations/{draft_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == draft_id

    # 3. Update answers and checklist
    patch_res = client.patch(
        f"/api/v1/preparations/{draft_id}",
        json={
            "answers": {"age": 20, "annual_income": 120000, "state_code": "UP"},
            "checklist_state": {"income_cert": True, "aadhaar": True},
        },
        headers={"x-csrf-token": csrf_token} if csrf_token else {},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["checklist_state"] == {"income_cert": True, "aadhaar": True}
    assert updated["eligibility_summary"]["outcome"] == "eligible"
    assert len(updated["eligibility_summary"]["missing_fields"]) == 0

    # 4. Delete the draft
    del_res = client.delete(
        f"/api/v1/preparations/{draft_id}",
        headers={"x-csrf-token": csrf_token} if csrf_token else {},
    )
    assert del_res.status_code == 204

    # 5. Confirm deletion
    assert client.get(f"/api/v1/preparations/{draft_id}").status_code == 404


def test_cannot_prepare_draft_for_unverified_scheme(client, draft_scheme):
    res = client.post(
        "/api/v1/preparations",
        json={"scheme_id": draft_scheme.slug},
    )
    assert res.status_code == 404


def test_session_isolation_for_preparations(client, verified_scheme):
    # Session A creates a draft
    res_a = client.post(
        "/api/v1/preparations",
        json={"scheme_id": verified_scheme.slug},
    )
    assert res_a.status_code == 201
    draft_id = res_a.json()["id"]

    # Clear cookies to simulate Session B
    client.cookies.clear()

    # Session B attempts to read Session A's draft -> 401 (no session) or 404
    assert client.get(f"/api/v1/preparations/{draft_id}").status_code in (401, 404)

    # Session B creates its own session
    res_b = client.post(
        "/api/v1/preparations",
        json={"scheme_id": verified_scheme.slug},
    )
    assert res_b.status_code == 201

    # Session B cannot access Session A's draft
    assert client.get(f"/api/v1/preparations/{draft_id}").status_code == 404
