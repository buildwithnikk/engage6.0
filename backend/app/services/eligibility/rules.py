"""The eligibility rule format: typed, validated, versioned.

Design constraints, in order of importance:

1. **No code execution.** No `eval`, no `exec`, no imported callables from data,
   no language model. A rule is data, and the evaluator is a fixed set of
   predicates over that data. A scheme row is operator-supplied content; it must
   never be able to run anything.
2. **Three-valued.** A fact the citizen did not supply is UNKNOWN, never a
   silent pass or fail. Telling someone they qualify when the answer is simply
   missing is the most harmful thing this service could do.
3. **Explainable.** Every condition reports its own outcome and a sentence a
   person can read. The result is never a bare verdict.
4. **Extensible without branching per scheme.** Adding a predicate means adding
   one class here, not an `if scheme.slug == ...` anywhere.

The document shape:

    {
      "version": "1",
      "all": [
        {"type": "age_min",     "fact": "age",            "value": 18},
        {"type": "income_max",  "fact": "annual_income",  "value": 250000},
        {"type": "state_in",    "fact": "state_code",     "values": ["UP", "BR"]},
        {"type": "category_in", "fact": "category",       "values": ["SC", "ST"]},
        {"type": "is_true",     "fact": "is_student"}
      ]
    }

`all` means every condition must hold — the only combinator in version 1.
`any`/`not` are deliberately absent until a real scheme needs them.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

RULES_FORMAT_VERSION = "1"


class _ConditionBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    #: Name of the answer this condition reads, e.g. "age".
    fact: str = Field(min_length=1, max_length=64)
    #: Optional human-readable override; a default is generated when absent.
    label: str | None = Field(default=None, max_length=200)

    @field_validator("fact")
    @classmethod
    def _fact_is_identifier(cls, v: str) -> str:
        # Facts become form field names and dictionary keys. Keeping them to a
        # strict identifier shape stops a rule from naming something surprising.
        if not v.replace("_", "").isalnum():
            raise ValueError("fact must contain only letters, digits and underscores")
        return v


class AgeMin(_ConditionBase):
    type: Literal["age_min"]
    value: int = Field(ge=0, le=150)

    def describe(self) -> str:
        return self.label or f"Age must be at least {self.value}"


class AgeMax(_ConditionBase):
    type: Literal["age_max"]
    value: int = Field(ge=0, le=150)

    def describe(self) -> str:
        return self.label or f"Age must be at most {self.value}"


class IncomeMax(_ConditionBase):
    type: Literal["income_max"]
    value: int = Field(ge=0)

    def describe(self) -> str:
        return self.label or f"Annual income must not exceed ₹{self.value:,}"


class IncomeMin(_ConditionBase):
    type: Literal["income_min"]
    value: int = Field(ge=0)

    def describe(self) -> str:
        return self.label or f"Annual income must be at least ₹{self.value:,}"


class StateIn(_ConditionBase):
    type: Literal["state_in"]
    values: list[str] = Field(min_length=1, max_length=40)

    def describe(self) -> str:
        return self.label or f"Must be a resident of: {', '.join(self.values)}"


class CategoryIn(_ConditionBase):
    type: Literal["category_in"]
    values: list[str] = Field(min_length=1, max_length=40)

    def describe(self) -> str:
        return self.label or f"Must belong to one of: {', '.join(self.values)}"


class IsTrue(_ConditionBase):
    type: Literal["is_true"]

    def describe(self) -> str:
        return self.label or f"'{self.fact}' must be true"


class IsFalse(_ConditionBase):
    type: Literal["is_false"]

    def describe(self) -> str:
        return self.label or f"'{self.fact}' must be false"


Condition = Annotated[
    AgeMin | AgeMax | IncomeMax | IncomeMin | StateIn | CategoryIn | IsTrue | IsFalse,
    Field(discriminator="type"),
]

#: Predicates this version understands. A rules document naming anything else is
#: not evaluated optimistically — see UnsupportedCondition handling in engine.py.
SUPPORTED_TYPES = (
    "age_min",
    "age_max",
    "income_max",
    "income_min",
    "state_in",
    "category_in",
    "is_true",
    "is_false",
)

#: What kind of answer each predicate needs. Drives the generated questionnaire,
#: so the frontend never has to know the rule vocabulary.
FACT_KINDS: dict[str, str] = {
    "age_min": "integer",
    "age_max": "integer",
    "income_max": "integer",
    "income_min": "integer",
    "state_in": "choice",
    "category_in": "choice",
    "is_true": "boolean",
    "is_false": "boolean",
}


class RuleDocument(BaseModel):
    """A scheme's complete rule set."""

    model_config = ConfigDict(extra="forbid")

    version: str = Field(default=RULES_FORMAT_VERSION, max_length=16)
    all: list[Condition] = Field(default_factory=list, max_length=50)

    @field_validator("version")
    @classmethod
    def _known_version(cls, v: str) -> str:
        if v != RULES_FORMAT_VERSION:
            raise ValueError(
                f"unsupported rules format version {v!r}; this build understands "
                f"{RULES_FORMAT_VERSION!r}"
            )
        return v


class UnsupportedRules(Exception):
    """The stored rules could not be parsed into a RuleDocument.

    Carries the reason so the API can report `needs_more_information` with an
    honest explanation instead of pretending the scheme has no criteria. A scheme
    whose rules we cannot read must never evaluate as `eligible`.
    """

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def parse_rules(raw: Any) -> RuleDocument:
    """Parse a stored rules document, raising UnsupportedRules on any problem."""
    if not isinstance(raw, dict):
        raise UnsupportedRules("Stored rules are not an object.")
    try:
        return RuleDocument.model_validate(raw)
    except Exception as exc:  # noqa: BLE001 - every parse failure is the same outcome
        raise UnsupportedRules(_first_problem(exc, raw)) from exc


def _first_problem(exc: Exception, raw: dict[str, Any]) -> str:
    """A short, non-technical reason, preferring the unknown-predicate case."""
    declared = raw.get("all")
    if isinstance(declared, list):
        for item in declared:
            if isinstance(item, dict):
                t = item.get("type")
                if isinstance(t, str) and t not in SUPPORTED_TYPES:
                    return f"This scheme uses a rule type this version cannot evaluate: {t!r}."
    version = raw.get("version")
    if isinstance(version, str) and version != RULES_FORMAT_VERSION:
        return (
            f"This scheme's rules use format version {version!r}, "
            f"but this build understands {RULES_FORMAT_VERSION!r}."
        )
    return f"This scheme's rules could not be read ({type(exc).__name__})."
