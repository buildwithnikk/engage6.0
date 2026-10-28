"""Integration tests for Phase 6 Government Source Registry and Import Pipeline."""

import pytest
from app.models.government_source import GovernmentSource
from app.services.admin.authentication import create_admin_user, create_session


@pytest.fixture
def editor_client(client, db_session):
    user = create_admin_user(
        db_session,
        email="editor.sources@sahayak.gov.in",
        password="Password123!",
        role="editor",
    )
    admin_session, raw_token, raw_csrf = create_session(
        db_session, user, client_ip="127.0.0.1"
    )
    db_session.flush()

    client.cookies.set("sahayak_admin_session", raw_token)
    client.headers["x-csrf-token"] = raw_csrf
    return client


def test_sources_and_import_lifecycle(editor_client, db_session):
    # 1. Register a new government source
    create_res = editor_client.post(
        "/api/v1/admin/sources",
        json={
            "name": "Ministry of Education Higher Edu Portal",
            "official_url": "https://education.gov.in",
            "source_type": "portal",
            "jurisdiction": "central",
            "notes": "Official portal for central higher education schemes",
        },
    )
    assert create_res.status_code == 201
    source_id = create_res.json()["id"]

    # 2. List sources
    list_res = editor_client.get("/api/v1/admin/sources")
    assert list_res.status_code == 200
    sources = list_res.json()["items"]
    assert any(s["id"] == source_id for s in sources)

    # 3. Trigger adapter sync for nsp_central
    sync_res = editor_client.post(
        "/api/v1/admin/sources/sync",
        json={"source_key": "nsp_central"},
    )
    assert sync_res.status_code == 200
    candidates = sync_res.json()["items"]
    assert len(candidates) >= 1
    candidate_id = candidates[0]["id"]
    slug = candidates[0]["extracted_data"]["slug"]

    # 4. Candidate is listed in pending state
    cand_res = editor_client.get("/api/v1/admin/import-candidates?status=pending")
    assert cand_res.status_code == 200
    assert any(c["id"] == candidate_id for c in cand_res.json()["items"])

    # 5. Candidate is NOT public
    public_res = editor_client.get(f"/api/v1/schemes/{slug}")
    assert public_res.status_code == 404

    # 6. Promote candidate to draft scheme
    promote_res = editor_client.post(
        f"/api/v1/admin/import-candidates/{candidate_id}/promote"
    )
    assert promote_res.status_code == 200
    promoted = promote_res.json()
    assert promoted["review_status"] == "draft"
    scheme_id = promoted["scheme_id"]

    # 7. Still not public because it is in draft
    assert editor_client.get(f"/api/v1/schemes/{slug}").status_code == 404

    # 8. Admin review workflow: submit review, then verify (as reviewer)
    # Give user reviewer role
    from app.models.admin_user import AdminUser
    user = db_session.query(AdminUser).filter_by(email="editor.sources@sahayak.gov.in").first()
    user.role = "admin"
    db_session.flush()

    sub_res = editor_client.post(f"/api/v1/admin/schemes/{scheme_id}/submit-review")
    assert sub_res.status_code == 200

    ver_res = editor_client.post(f"/api/v1/admin/schemes/{scheme_id}/verify")
    assert ver_res.status_code == 200

    # 9. Now public! Displays source_url and verified_at
    pub_detail = editor_client.get(f"/api/v1/schemes/{slug}").json()
    assert pub_detail["review_status"] == "verified"
    assert pub_detail["source_url"] == "https://scholarships.gov.in"
    assert pub_detail["verified_at"] is not None
