"""Unit tests for scheme validation and review rules."""

import pytest

from app.services.admin import scheme_review


def test_url_validation():
    scheme_review.validate_url("https://example.gov.in/scheme", "source_url", required=True)
    scheme_review.validate_url("http://example.gov.in/scheme", "source_url", required=True)

    with pytest.raises(scheme_review.ValidationError):
        scheme_review.validate_url("ftp://example.gov.in", "source_url", required=True)

    with pytest.raises(scheme_review.ValidationError):
        scheme_review.validate_url("not-a-url", "source_url", required=True)

    with pytest.raises(scheme_review.ValidationError):
        scheme_review.validate_url("", "source_url", required=True)

    # Optional URL
    scheme_review.validate_url(None, "official_apply_url", required=False)
    scheme_review.validate_url("", "official_apply_url", required=False)


def test_rules_validation():
    valid_rules = {
        "version": "1",
        "all": [
            {"type": "age_min", "fact": "age", "value": 18},
        ],
    }
    scheme_review.validate_rules(valid_rules)

    invalid_rules = {
        "version": "1",
        "all": [
            {"type": "unsupported_type", "fact": "age", "value": 18},
        ],
    }
    with pytest.raises(scheme_review.ValidationError):
        scheme_review.validate_rules(invalid_rules)
