"""Integration tests for admin scheme curation, role permissions and visibility."""


from starlette.testclient import TestClient

from app.models.admin_user import AdminUser
from app.services.admin import authentication as auth_service


def _login_user(client: TestClient, db_session, email: str, role: str) -> tuple[str, str]:
    """Helper: create user and return (session_cookie, csrf_token)."""
    user = AdminUser(
        email=email,
        password_hash=auth_service.hash_password("password123"),
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    res = client.post(
        "/api/v1/admin/auth/login",
        json={"email": email, "password": "password123"},
    )
    cookie = res.cookies["sahayak_admin_session"]
    csrf_token = res.json()["csrf_token"]
    return cookie, csrf_token


def test_scheme_lifecycle_roles_and_public_visibility(client: TestClient, db_session):
    # Setup users
    ed_cookie, ed_csrf = _login_user(client, db_session, "ed@example.com", "editor")
    rev_cookie, rev_csrf = _login_user(client, db_session, "rev@example.com", "reviewer")
    adm_cookie, adm_csrf = _login_user(client, db_session, "adm@example.com", "admin")

    # 1. Editor creates a draft scheme
    create_payload = {
        "slug": "test-farmer-aid",
        "official_name": "Farmer Support Scheme",
        "department": "Department of Agriculture",
        "jurisdiction": "central",
        "state_code": None,
        "benefit_summary": "Annual grant of Rs. 6000 for small farmers.",
        "eligibility_rules": {
            "version": "1",
            "all": [{"type": "is_true", "fact": "is_farmer"}],
        },
        "required_documents": ["aadhaar", "land_record"],
        "official_apply_url": "https://agriculture.gov.in/apply",
        "source_url": "https://agriculture.gov.in/scheme-guidelines",
    }
    create_res = client.post(
        "/api/v1/admin/schemes",
        json=create_payload,
        cookies={"sahayak_admin_session": ed_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": ed_csrf},
    )
    assert create_res.status_code == 201
    scheme_data = create_res.json()
    scheme_id = scheme_data["id"]
    assert scheme_data["review_status"] == "draft"

    # 2. Public endpoints must NOT leak draft scheme
    pub_list = client.get("/api/v1/schemes").json()
    assert all(s["slug"] != "test-farmer-aid" for s in pub_list["items"])
    pub_get = client.get(f"/api/v1/schemes/{scheme_id}")
    assert pub_get.status_code == 404

    # 3. Editor submits draft for review
    submit_res = client.post(
        f"/api/v1/admin/schemes/{scheme_id}/submit-review",
        cookies={"sahayak_admin_session": ed_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": ed_csrf},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["review_status"] == "needs_review"

    # Still hidden from public
    assert client.get(f"/api/v1/schemes/{scheme_id}").status_code == 404

    # 4. Role check: Editor CANNOT verify or archive or read audit
    ed_verify = client.post(
        f"/api/v1/admin/schemes/{scheme_id}/verify",
        cookies={"sahayak_admin_session": ed_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": ed_csrf},
    )
    assert ed_verify.status_code == 403

    ed_audit = client.get(
        "/api/v1/admin/audit-events",
        cookies={"sahayak_admin_session": ed_cookie},
    )
    assert ed_audit.status_code == 403

    # 5. Reviewer requests changes
    req_changes = client.post(
        f"/api/v1/admin/schemes/{scheme_id}/request-changes",
        json={"reason": "Please clarify land holding criteria in rules."},
        cookies={"sahayak_admin_session": rev_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": rev_csrf},
    )
    assert req_changes.status_code == 200
    assert req_changes.json()["review_status"] == "draft"

    # 6. Editor re-submits after update
    submit_res2 = client.post(
        f"/api/v1/admin/schemes/{scheme_id}/submit-review",
        cookies={"sahayak_admin_session": ed_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": ed_csrf},
    )
    assert submit_res2.status_code == 200
    assert submit_res2.json()["review_status"] == "needs_review"

    # 7. Reviewer approves & verifies scheme
    verify_res = client.post(
        f"/api/v1/admin/schemes/{scheme_id}/verify",
        cookies={"sahayak_admin_session": rev_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": rev_csrf},
    )
    assert verify_res.status_code == 200
    verified_data = verify_res.json()
    assert verified_data["review_status"] == "verified"
    assert verified_data["verified_at"] is not None

    # 8. NOW public endpoints serve the verified scheme!
    pub_get_verified = client.get(f"/api/v1/schemes/{scheme_id}")
    assert pub_get_verified.status_code == 200
    assert pub_get_verified.json()["official_name"] == "Farmer Support Scheme"

    # 9. Editing a verified scheme invalidates verification & public access
    updated_at_val = verified_data["updated_at"]
    patch_res = client.patch(
        f"/api/v1/admin/schemes/{scheme_id}",
        json={
            "expected_updated_at": updated_at_val,
            "benefit_summary": "Updated benefit description.",
        },
        cookies={"sahayak_admin_session": ed_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": ed_csrf},
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert patched_data["review_status"] == "needs_review"
    assert patched_data["verified_at"] is None

    # Scheme is immediately hidden from public endpoints again!
    assert client.get(f"/api/v1/schemes/{scheme_id}").status_code == 404

    # 10. Concurrency Conflict: passing stale expected_updated_at returns 409
    stale_patch = client.patch(
        f"/api/v1/admin/schemes/{scheme_id}",
        json={
            "expected_updated_at": "2020-01-01T00:00:00Z",
            "benefit_summary": "Stale edit.",
        },
        cookies={"sahayak_admin_session": ed_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": ed_csrf},
    )
    assert stale_patch.status_code == 409
    assert "modified by another user" in stale_patch.json()["detail"]

    # 11. Reviewer archives scheme
    archive_res = client.post(
        f"/api/v1/admin/schemes/{scheme_id}/archive",
        cookies={"sahayak_admin_session": rev_cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": rev_csrf},
    )
    assert archive_res.status_code == 200
    assert archive_res.json()["review_status"] == "archived"

    # 12. Admin views audit events
    audit_res = client.get(
        "/api/v1/admin/audit-events",
        cookies={"sahayak_admin_session": adm_cookie},
    )
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["total"] > 0
    # Audit events contain no session token or plaintext password
    for item in audit_data["items"]:
        raw_str = str(item)
        assert "password123" not in raw_str
        assert "adminSecret" not in raw_str
        assert ed_cookie not in raw_str
        assert rev_cookie not in raw_str
        assert adm_cookie not in raw_str
