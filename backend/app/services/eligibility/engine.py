"""Deterministic eligibility evaluation.

Pure functions: no database, no network, no clock, no randomness, no model.
The same answers against the same rules give the same result, always — which is
what makes `rules_version` on the response meaningful.

Three outcomes, and the third one is the point:

    eligible                — every condition met
    ineligible              — at least one condition definitively failed
    needs_more_information  — nothing failed, but something is unknown

A missing answer is never treated as a pass. If a rule cannot be read at all,
the answer is `needs_more_information` with the reason, never `eligible`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.services.eligibility.rules import (
    FACT_KINDS,
    AgeMax,
    AgeMin,
    CategoryIn,
    Condition,
    IncomeMax,
    IncomeMin,
    IsFalse,
    IsTrue,
    RuleDocument,
    StateIn,
    UnsupportedRules,
    parse_rules,
)

Outcome = Literal["eligible", "ineligible", "needs_more_information"]
ConditionStatus = Literal["met", "failed", "unknown"]


@dataclass(frozen=True)
class ConditionResult:
    fact: str
    type: str
    status: ConditionStatus
    requirement: str
    explanation: str


@dataclass(frozen=True)
class EvaluationResult:
    outcome: Outcome
    summary: str
    met: list[ConditionResult]
    failed: list[ConditionResult]
    unknown: list[ConditionResult]
    missing_facts: list[str]


def _as_int(value: Any) -> int | None:
    """Coerce an answer to int, or None when it is not usable.

    `bool` is rejected explicitly: in Python `True` is an int, and an age of
    `True` silently becoming 1 is exactly the kind of quiet wrong answer this
    service must not produce.
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        text = value.strip().replace(",", "")
        if text.lstrip("-").isdigit():
            return int(text)
    return None


def _as_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"true", "yes", "y", "1"}:
            return True
        if text in {"false", "no", "n", "0"}:
            return False
    return None


def _as_text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _unknown(cond: Condition, why: str) -> ConditionResult:
    return ConditionResult(
        fact=cond.fact,
        type=cond.type,
        status="unknown",
        requirement=cond.describe(),
        explanation=why,
    )


def _evaluate_condition(cond: Condition, answers: dict[str, Any]) -> ConditionResult:
    raw = answers.get(cond.fact)
    requirement = cond.describe()

    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return _unknown(cond, f"You have not told us your {cond.fact.replace('_', ' ')}.")

    def result(status: ConditionStatus, explanation: str) -> ConditionResult:
        return ConditionResult(
            fact=cond.fact,
            type=cond.type,
            status=status,
            requirement=requirement,
            explanation=explanation,
        )

    if isinstance(cond, (AgeMin, AgeMax, IncomeMax, IncomeMin)):
        number = _as_int(raw)
        if number is None:
            return _unknown(cond, f"'{raw}' is not a number we can compare.")

        if isinstance(cond, AgeMin):
            ok = number >= cond.value
            return result(
                "met" if ok else "failed",
                f"You are {number}; the minimum is {cond.value}."
                if ok
                else f"You are {number}, below the minimum of {cond.value}.",
            )
        if isinstance(cond, AgeMax):
            ok = number <= cond.value
            return result(
                "met" if ok else "failed",
                f"You are {number}; the maximum is {cond.value}."
                if ok
                else f"You are {number}, above the maximum of {cond.value}.",
            )
        if isinstance(cond, IncomeMax):
            ok = number <= cond.value
            return result(
                "met" if ok else "failed",
                f"Your income ₹{number:,} is within the limit of ₹{cond.value:,}."
                if ok
                else f"Your income ₹{number:,} exceeds the limit of ₹{cond.value:,}.",
            )
        # IncomeMin
        ok = number >= cond.value
        return result(
            "met" if ok else "failed",
            f"Your income ₹{number:,} meets the minimum of ₹{cond.value:,}."
            if ok
            else f"Your income ₹{number:,} is below the minimum of ₹{cond.value:,}.",
        )

    if isinstance(cond, (StateIn, CategoryIn)):
        text = _as_text(raw)
        if text is None:
            return _unknown(cond, "That answer is not a value we can compare.")
        # Case-insensitive: citizens type "up", forms say "UP".
        allowed = {v.strip().lower() for v in cond.values}
        ok = text.lower() in allowed
        return result(
            "met" if ok else "failed",
            f"'{text}' is in the accepted list."
            if ok
            else f"'{text}' is not in the accepted list ({', '.join(cond.values)}).",
        )

    if isinstance(cond, (IsTrue, IsFalse)):
        flag = _as_bool(raw)
        if flag is None:
            return _unknown(cond, "That answer is not a yes or no we can read.")
        expected = isinstance(cond, IsTrue)
        ok = flag is expected
        return result(
            "met" if ok else "failed",
            f"You answered {'yes' if flag else 'no'}, which is what this scheme requires."
            if ok
            else f"You answered {'yes' if flag else 'no'}, "
            f"but this scheme requires {'yes' if expected else 'no'}.",
        )

    # Unreachable while Condition stays a closed union; kept so a future
    # predicate added to rules.py but not here fails safe instead of passing.
    return _unknown(cond, "This condition type cannot be evaluated by this build.")


def evaluate_document(document: RuleDocument, answers: dict[str, Any]) -> EvaluationResult:
    results = [_evaluate_condition(c, answers) for c in document.all]

    met = [r for r in results if r.status == "met"]
    failed = [r for r in results if r.status == "failed"]
    unknown = [r for r in results if r.status == "unknown"]

    if failed:
        outcome: Outcome = "ineligible"
        summary = (
            f"Based on the recorded rules, you do not appear to qualify: "
            f"{len(failed)} requirement{'s' if len(failed) != 1 else ''} not met."
        )
    elif unknown:
        outcome = "needs_more_information"
        summary = (
            f"We cannot decide yet. {len(unknown)} question"
            f"{'s' if len(unknown) != 1 else ''} still unanswered."
        )
    elif not results:
        # A scheme with no conditions recorded is not an open door. Saying
        # "eligible" here would be asserting something nobody checked.
        outcome = "needs_more_information"
        summary = (
            "This scheme has no eligibility rules recorded yet, so no check can be made. "
            "Please read the official source."
        )
    else:
        outcome = "eligible"
        summary = "Based on the recorded rules, you appear to meet every requirement."

    return EvaluationResult(
        outcome=outcome,
        summary=summary,
        met=met,
        failed=failed,
        unknown=unknown,
        missing_facts=sorted({r.fact for r in unknown}),
    )


def evaluate(raw_rules: Any, answers: dict[str, Any]) -> EvaluationResult:
    """Evaluate stored rules. Unreadable rules yield needs_more_information."""
    try:
        document = parse_rules(raw_rules)
    except UnsupportedRules as exc:
        return EvaluationResult(
            outcome="needs_more_information",
            summary=f"{exc.reason} Please check the scheme's official source.",
            met=[],
            failed=[],
            unknown=[],
            missing_facts=[],
        )
    return evaluate_document(document, answers)


def required_facts(raw_rules: Any) -> list[dict[str, Any]]:
    """Describe the questions a scheme needs answered.

    Drives the frontend questionnaire, so the UI never hardcodes the rule
    vocabulary. Returns [] for rules this build cannot read, which is how the UI
    knows to show the explanation instead of a form.
    """
    try:
        document = parse_rules(raw_rules)
    except UnsupportedRules:
        return []

    seen: dict[str, dict[str, Any]] = {}
    for cond in document.all:
        entry = seen.setdefault(
            cond.fact,
            {
                "fact": cond.fact,
                "kind": FACT_KINDS.get(cond.type, "text"),
                "requirements": [],
                "choices": [],
            },
        )
        entry["requirements"].append(cond.describe())
        if isinstance(cond, (StateIn, CategoryIn)):
            for value in cond.values:
                if value not in entry["choices"]:
                    entry["choices"].append(value)
    return list(seen.values())
