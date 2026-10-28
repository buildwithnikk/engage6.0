"""Integration tests for Phase 5 preferences, geographic filters and locale registry."""

import pytest


def test_get_location_metadata(client):
    res = client.get("/api/v1/preferences/metadata")
    assert res.status_code == 200
    data = res.json()

    assert "states" in data and "locales" in data
    state_codes = [s["code"] for s in data["states"]]
    assert "UP" in state_codes
    assert "DL" in state_codes
    assert "MH" in state_codes

    # Locales check
    locales = {l["code"]: l for l in data["locales"]}
    assert locales["en"]["is_supported"] is True
    assert locales["hi"]["is_supported"] is True
    assert locales["bn"]["is_supported"] is False  # registered for future


def test_preferences_lifecycle(client):
    # 1. Initial preferences
    res = client.get("/api/v1/preferences")
    assert res.status_code == 200
    body = res.json()
    assert body["has_set_preferences"] is False
    assert body["preferences"]["language"] == "en"

    # 2. Update preferences
    update_res = client.put(
        "/api/v1/preferences",
        json={
            "language": "hi",
            "state_code": "UP",
            "district": "Lucknow",
            "area_type": "rural",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["has_set_preferences"] is True
    assert updated["preferences"]["language"] == "hi"
    assert updated["preferences"]["state_code"] == "UP"
    assert updated["preferences"]["district"] == "Lucknow"
    assert updated["preferences"]["area_type"] == "rural"

    # 3. Read back preferences
    read_res = client.get("/api/v1/preferences")
    assert read_res.status_code == 200
    assert read_res.json()["preferences"]["state_code"] == "UP"

    # 4. Reset preferences
    reset_res = client.delete("/api/v1/preferences")
    assert reset_res.status_code == 200
    assert reset_res.json()["has_set_preferences"] is False

    # 5. Verify reset
    final_res = client.get("/api/v1/preferences")
    assert final_res.json()["has_set_preferences"] is False


def test_invalid_district_rejected(client):
    # Pune is in MH, not UP
    res = client.put(
        "/api/v1/preferences",
        json={
            "state_code": "UP",
            "district": "Pune",
        },
    )
    assert res.status_code == 400
    assert "not valid for state UP" in res.json()["detail"]


def test_unsupported_language_rejected(client):
    # Bengali is registered but not supported yet
    res = client.put(
        "/api/v1/preferences",
        json={"language": "bn"},
    )
    assert res.status_code == 400
    assert "not yet supported" in res.json()["detail"]
