"""The health endpoint, through the real ASGI app with FastAPI's TestClient."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client(monkeypatch) -> TestClient:
    """A client with no DATABASE_URL — the Phase 0 default."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    get_settings.cache_clear()
    return TestClient(create_app())


def test_app_imports_and_serves_without_supabase_credentials(client):
    assert client.get("/api/v1/health").status_code == 200


def test_health_shape_and_unconfigured_database(client):
    body = client.get("/api/v1/health").json()

    assert body["status"] == "ok"
    assert body["version"] == "0.1.0"
    assert body["database"] == "unconfigured"
    assert set(body) == {"status", "version", "database", "detail"}


def test_health_reports_unavailable_for_an_unreachable_database(monkeypatch):
    """Configured but dead must be 'unavailable', never 'ok'."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://postgres:pw@127.0.0.1:1/postgres")
    monkeypatch.setenv("DB_CONNECT_TIMEOUT", "1")
    get_settings.cache_clear()

    body = TestClient(create_app()).get("/api/v1/health").json()

    assert body["database"] == "unavailable"
    assert "pw" not in (body["detail"] or "")


def test_health_never_leaks_the_connection_string(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://admin:leakme@db.example.co:5432/postgres"
    )
    monkeypatch.setenv("DB_CONNECT_TIMEOUT", "1")
    get_settings.cache_clear()

    raw = TestClient(create_app()).get("/api/v1/health").text

    for secret in ("leakme", "admin", "db.example.co"):
        assert secret not in raw


def test_cors_preflight_allows_the_configured_frontend_origin(monkeypatch):
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "http://localhost:3000")
    get_settings.cache_clear()

    res = TestClient(create_app()).options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_does_not_echo_an_unconfigured_origin(monkeypatch):
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "http://localhost:3000")
    get_settings.cache_clear()

    res = TestClient(create_app()).get(
        "/api/v1/health", headers={"Origin": "http://evil.example.com"}
    )

    assert res.headers.get("access-control-allow-origin") != "http://evil.example.com"


def test_no_phase_1_endpoint_is_exposed_yet(client):
    """Guard against silently starting Phase 1."""
    for path in ("/api/v1/schemes", "/api/v1/eligibility", "/api/v1/documents"):
        assert client.get(path).status_code == 404


def test_openapi_documents_only_the_health_route(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert list(paths) == ["/api/v1/health"]
