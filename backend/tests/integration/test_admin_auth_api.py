"""Integration tests for admin authentication, sessions and CSRF."""

from starlette.testclient import TestClient

from app.models.admin_user import AdminUser
from app.services.admin import authentication as auth_service


def test_anonymous_user_cannot_access_admin_me(client: TestClient):
    res = client.get("/api/v1/admin/me")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]


def test_admin_login_success_and_logout(client: TestClient, db_session):
    auth_service.reset_rate_limits()

    user = AdminUser(
        email="testadmin@example.com",
        password_hash=auth_service.hash_password("adminSecret123"),
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    # 1. Login
    login_res = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "testadmin@example.com", "password": "adminSecret123"},
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["user"]["email"] == "testadmin@example.com"
    assert data["user"]["role"] == "admin"
    csrf_token = data["csrf_token"]
    assert csrf_token is not None

    cookie = login_res.cookies.get("sahayak_admin_session")
    assert cookie is not None

    # 2. Access /admin/me with session cookie
    me_res = client.get("/api/v1/admin/me", cookies={"sahayak_admin_session": cookie})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["email"] == "testadmin@example.com"
    new_csrf_token = me_data["csrf_token"]

    # 3. State-changing request requires matching CSRF token and valid Origin
    # 3a. Missing CSRF header fails
    bad_logout = client.post(
        "/api/v1/admin/auth/logout",
        cookies={"sahayak_admin_session": cookie},
        headers={"Origin": "http://localhost:3000"},
    )
    assert bad_logout.status_code == 403
    assert "CSRF" in bad_logout.json()["detail"]

    # 3b. Untrusted Origin fails
    bad_origin_logout = client.post(
        "/api/v1/admin/auth/logout",
        cookies={"sahayak_admin_session": cookie},
        headers={"Origin": "http://evil.com", "X-CSRF-Token": new_csrf_token},
    )
    assert bad_origin_logout.status_code == 403

    # 3c. Valid CSRF and trusted Origin succeeds
    good_logout = client.post(
        "/api/v1/admin/auth/logout",
        cookies={"sahayak_admin_session": cookie},
        headers={"Origin": "http://localhost:3000", "X-CSRF-Token": new_csrf_token},
    )
    assert good_logout.status_code == 200
    assert good_logout.json()["status"] == "ok"

    # 4. Old session is revoked
    revoked_me = client.get("/api/v1/admin/me", cookies={"sahayak_admin_session": cookie})
    assert revoked_me.status_code == 401


def test_invalid_credentials_and_rate_limiting(client: TestClient, db_session):
    auth_service.reset_rate_limits()

    user = AdminUser(
        email="lockedout@example.com",
        password_hash=auth_service.hash_password("correctPassword123"),
        role="editor",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    # 4 failed attempts: returns 401
    for _ in range(4):
        res = client.post(
            "/api/v1/admin/auth/login",
            json={"email": "lockedout@example.com", "password": "wrongPassword"},
        )
        assert res.status_code == 401
        assert "Invalid email or password" in res.json()["detail"]

    # 5th failed attempt: trips rate limit
    res5 = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "lockedout@example.com", "password": "wrongPassword"},
    )
    assert res5.status_code == 401

    # 6th attempt is rate-limited: 429
    res6 = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "lockedout@example.com", "password": "correctPassword123"},
    )
    assert res6.status_code == 429
    assert "Too many failed login attempts" in res6.json()["detail"]

    auth_service.reset_rate_limits()


def test_disabled_account_cannot_log_in(client: TestClient, db_session):
    auth_service.reset_rate_limits()

    user = AdminUser(
        email="disabled@example.com",
        password_hash=auth_service.hash_password("validPassword123"),
        role="reviewer",
        is_active=False,
    )
    db_session.add(user)
    db_session.flush()

    res = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "disabled@example.com", "password": "validPassword123"},
    )
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"]
