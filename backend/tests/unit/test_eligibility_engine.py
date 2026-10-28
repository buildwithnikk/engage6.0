"""The evaluator. These tests are the specification for how results are decided."""

import pytest

from app.services.eligibility.engine import evaluate, required_facts

SIMPLE = {
    "version": "1",
    "all": [
        {"type": "age_min", "fact": "age", "value": 18},
        {"type": "age_max", "fact": "age", "value": 25},
        {"type": "income_max", "fact": "annual_income", "value": 250000},
        {"type": "state_in", "fact": "state_code", "values": ["UP", "BR"]},
        {"type": "is_true", "fact": "is_student"},
    ],
}


def test_all_conditions_met_is_eligible():
    r = evaluate(
        SIMPLE,
        {"age": 19, "annual_income": 96000, "state_code": "UP", "is_student": True},
    )
    assert r.outcome == "eligible"
    assert len(r.met) == 5
    assert r.failed == [] and r.unknown == []


def test_one_failure_is_ineligible():
    r = evaluate(
        SIMPLE,
        {"age": 19, "annual_income": 900000, "state_code": "UP", "is_student": True},
    )
    assert r.outcome == "ineligible"
    assert [f.fact for f in r.failed] == ["annual_income"]


def test_missing_answer_is_needs_more_information_not_eligible():
    """The single most important behaviour in this service."""
    r = evaluate(SIMPLE, {"age": 19})
    assert r.outcome == "needs_more_information"
    assert set(r.missing_facts) == {"annual_income", "state_code", "is_student"}


def test_no_answers_at_all_is_never_eligible():
    assert evaluate(SIMPLE, {}).outcome == "needs_more_information"


def test_a_definite_failure_outranks_unknowns():
    """Knowing one answer disqualifies is enough; the rest need not be asked."""
    r = evaluate(SIMPLE, {"age": 40})
    assert r.outcome == "ineligible"


def test_unsupported_rules_are_never_eligible():
    r = evaluate({"version": "1", "all": [{"type": "lunar_phase_in", "fact": "p"}]}, {"p": "x"})
    assert r.outcome == "needs_more_information"
    assert "lunar_phase_in" in r.summary


def test_malformed_rules_are_never_eligible():
    for raw in (None, "nonsense", {"version": "7", "all": []}, {"all": "not-a-list"}):
        assert evaluate(raw, {"age": 19}).outcome == "needs_more_information"


def test_scheme_with_no_conditions_is_not_an_open_door():
    """Zero recorded rules means nobody checked, not that everyone qualifies."""
    r = evaluate({"version": "1", "all": []}, {"age": 19})
    assert r.outcome == "needs_more_information"


@pytest.mark.parametrize("value", [18, "18", " 18 ", 18.0, "1,8".replace(",", "")])
def test_numeric_answers_are_coerced_sensibly(value):
    rules = {"version": "1", "all": [{"type": "age_min", "fact": "age", "value": 18}]}
    assert evaluate(rules, {"age": value}).outcome == "eligible"


def test_boolean_is_not_accepted_as_a_number():
    """In Python True == 1. An age of True must not quietly become 1."""
    rules = {"version": "1", "all": [{"type": "age_min", "fact": "age", "value": 1}]}
    r = evaluate(rules, {"age": True})
    assert r.outcome == "needs_more_information"


@pytest.mark.parametrize("value", ["abc", "", "   ", None, [], {}])
def test_unusable_numeric_answers_are_unknown_not_failures(value):
    rules = {"version": "1", "all": [{"type": "age_min", "fact": "age", "value": 18}]}
    assert evaluate(rules, {"age": value}).outcome == "needs_more_information"


def test_boundary_values_are_inclusive():
    rules = {
        "version": "1",
        "all": [
            {"type": "age_min", "fact": "age", "value": 18},
            {"type": "age_max", "fact": "age", "value": 25},
        ],
    }
    assert evaluate(rules, {"age": 18}).outcome == "eligible"
    assert evaluate(rules, {"age": 25}).outcome == "eligible"
    assert evaluate(rules, {"age": 17}).outcome == "ineligible"
    assert evaluate(rules, {"age": 26}).outcome == "ineligible"


def test_income_max_boundary_is_inclusive():
    rules = {"version": "1", "all": [{"type": "income_max", "fact": "i", "value": 250000}]}
    assert evaluate(rules, {"i": 250000}).outcome == "eligible"
    assert evaluate(rules, {"i": 250001}).outcome == "ineligible"


def test_choice_matching_ignores_case_and_spacing():
    rules = {"version": "1", "all": [{"type": "state_in", "fact": "s", "values": ["UP"]}]}
    assert evaluate(rules, {"s": " up "}).outcome == "eligible"


@pytest.mark.parametrize(
    ("answer", "expected"),
    [
        (True, "eligible"),
        ("yes", "eligible"),
        ("true", "eligible"),
        (False, "ineligible"),
        ("no", "ineligible"),
    ],
)
def test_boolean_answers(answer, expected):
    rules = {"version": "1", "all": [{"type": "is_true", "fact": "flag"}]}
    assert evaluate(rules, {"flag": answer}).outcome == expected


def test_is_false_condition():
    rules = {"version": "1", "all": [{"type": "is_false", "fact": "flag"}]}
    assert evaluate(rules, {"flag": False}).outcome == "eligible"
    assert evaluate(rules, {"flag": True}).outcome == "ineligible"


def test_every_condition_is_explained():
    r = evaluate(SIMPLE, {"age": 40, "annual_income": 900000})
    for item in r.met + r.failed + r.unknown:
        assert item.requirement and item.explanation


def test_evaluation_is_deterministic():
    answers = {"age": 19, "annual_income": 96000, "state_code": "UP", "is_student": True}
    first = evaluate(SIMPLE, answers)
    for _ in range(5):
        again = evaluate(SIMPLE, answers)
        assert again.outcome == first.outcome
        assert [c.explanation for c in again.met] == [c.explanation for c in first.met]


def test_required_facts_describe_the_questionnaire():
    facts = {f["fact"]: f for f in required_facts(SIMPLE)}
    assert set(facts) == {"age", "annual_income", "state_code", "is_student"}
    assert facts["age"]["kind"] == "integer"
    assert facts["is_student"]["kind"] == "boolean"
    assert facts["state_code"]["kind"] == "choice"
    assert facts["state_code"]["choices"] == ["UP", "BR"]
    # age carries both a min and a max, and both must be shown to the citizen.
    assert len(facts["age"]["requirements"]) == 2


def test_required_facts_is_empty_for_unreadable_rules():
    assert required_facts({"version": "1", "all": [{"type": "nope", "fact": "x"}]}) == []
