"""The rule parser: what it accepts, and what it must refuse."""

import pytest

from app.services.eligibility.rules import (
    RULES_FORMAT_VERSION,
    AgeMin,
    RuleDocument,
    UnsupportedRules,
    parse_rules,
)


def test_parses_a_well_formed_document():
    doc = parse_rules(
        {
            "version": "1",
            "all": [
                {"type": "age_min", "fact": "age", "value": 18},
                {"type": "state_in", "fact": "state_code", "values": ["UP"]},
            ],
        }
    )
    assert isinstance(doc, RuleDocument)
    assert len(doc.all) == 2
    assert isinstance(doc.all[0], AgeMin)


def test_empty_condition_list_is_valid_but_meaningless():
    assert parse_rules({"version": "1", "all": []}).all == []


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "a string",
        42,
        ["list"],
    ],
)
def test_non_object_rules_are_refused(raw):
    with pytest.raises(UnsupportedRules):
        parse_rules(raw)


def test_unknown_predicate_is_refused_and_named():
    with pytest.raises(UnsupportedRules) as exc:
        parse_rules({"version": "1", "all": [{"type": "lunar_phase_in", "fact": "x"}]})
    assert "lunar_phase_in" in exc.value.reason


def test_future_format_version_is_refused():
    with pytest.raises(UnsupportedRules) as exc:
        parse_rules({"version": "99", "all": []})
    assert "99" in exc.value.reason
    assert RULES_FORMAT_VERSION in exc.value.reason


def test_extra_keys_are_refused():
    """extra='forbid' catches a typo instead of silently ignoring a condition."""
    with pytest.raises(UnsupportedRules):
        parse_rules({"version": "1", "all": [], "unexpected": True})


def test_condition_with_unexpected_field_is_refused():
    with pytest.raises(UnsupportedRules):
        parse_rules(
            {"version": "1", "all": [{"type": "age_min", "fact": "age", "value": 18, "oops": 1}]}
        )


def test_fact_name_must_be_identifier_like():
    with pytest.raises(UnsupportedRules):
        parse_rules({"version": "1", "all": [{"type": "age_min", "fact": "age; drop", "value": 1}]})


def test_out_of_range_age_is_refused():
    with pytest.raises(UnsupportedRules):
        parse_rules({"version": "1", "all": [{"type": "age_min", "fact": "age", "value": 999}]})


def test_negative_income_is_refused():
    with pytest.raises(UnsupportedRules):
        parse_rules(
            {"version": "1", "all": [{"type": "income_max", "fact": "income", "value": -5}]}
        )


def test_choice_condition_needs_at_least_one_value():
    with pytest.raises(UnsupportedRules):
        parse_rules({"version": "1", "all": [{"type": "state_in", "fact": "s", "values": []}]})
