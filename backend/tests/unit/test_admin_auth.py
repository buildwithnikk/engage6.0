"""Unit tests for admin authentication services."""

import pytest

from app.services.admin import authentication as auth_service


def test_password_hashing_and_verification():
    pw = "SuperSecurePassword123!"
    hashed = auth_service.hash_password(pw)

    assert hashed != pw
    assert hashed.startswith("$argon2")
    assert auth_service.verify_password(pw, hashed)
    assert not auth_service.verify_password("WrongPassword!", hashed)


def test_token_hashing_is_deterministic():
    token = "random-token-12345"
    h1 = auth_service.hash_token(token)
    h2 = auth_service.hash_token(token)

    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hexdigest
    assert h1 != token


def test_rate_limiting_tracks_failures():
    auth_service.reset_rate_limits()
    key = "testuser@example.com:127.0.0.1"

    # 4 failures should pass rate check
    for _ in range(4):
        auth_service.record_failed_attempt(key)
        auth_service.check_rate_limit(key)

    # 5th failure trips limit
    auth_service.record_failed_attempt(key)
    with pytest.raises(auth_service.RateLimitExceededError):
        auth_service.check_rate_limit(key)

    auth_service.reset_rate_limits()

