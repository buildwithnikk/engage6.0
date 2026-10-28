# Eligibility rule format

Version **1**. Defined in `backend/app/services/eligibility/rules.py`, evaluated by
`backend/app/services/eligibility/engine.py`.

## What a rule document looks like

Stored in `schemes.eligibility_rules` (JSONB):

```json
{
  "version": "1",
  "all": [
    {"type": "age_min",     "fact": "age",           "value": 18},
    {"type": "age_max",     "fact": "age",           "value": 25},
    {"type": "income_max",  "fact": "annual_income", "value": 250000},
    {"type": "state_in",    "fact": "state_code",    "values": ["UP"]},
    {"type": "is_true",     "fact": "is_student",
     "label": "Must currently be enrolled as a student"}
  ]
}
```

`all` means every condition must hold. It is the only combinator in version 1 — `any` and
`not` are deliberately absent until a real scheme needs them, because an untested combinator
is a liability, not a feature.

## Fields

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | Which predicate. Must be one of the supported types below. |
| `fact` | yes | The answer this condition reads. Letters, digits and underscores only. |
| `value` | for numeric types | The threshold. |
| `values` | for choice types | Accepted values, 1–40 of them. |
| `label` | no | Human-readable requirement text. A sensible default is generated when absent. |

## Supported predicates

| `type` | Answer kind | Holds when |
|---|---|---|
| `age_min` | integer | answer ≥ value |
| `age_max` | integer | answer ≤ value |
| `income_min` | integer | answer ≥ value |
| `income_max` | integer | answer ≤ value |
| `state_in` | choice | answer matches one of `values` (case-insensitive) |
| `category_in` | choice | answer matches one of `values` (case-insensitive) |
| `is_true` | boolean | answer is true |
| `is_false` | boolean | answer is false |

All numeric bounds are **inclusive**: `age_min: 18` is met by exactly 18. Off-by-one at a
threshold is the likeliest real bug here, so it is asserted directly in
`tests/unit/test_eligibility_engine.py`.

## The three outcomes

| Outcome | When |
|---|---|
| `eligible` | Every condition met. |
| `ineligible` | At least one condition definitively failed. |
| `needs_more_information` | Nothing failed, but something is unknown. |

A condition is **unknown** when the answer is absent, blank, or unusable (`"abc"` for a
number). A failure outranks an unknown: if one answer already disqualifies, the result is
`ineligible` without demanding the rest.

**A missing answer is never a pass.** This is the single most important property of the
evaluator. Telling a citizen they qualify when nobody supplied the deciding fact costs them a
trip, a day's wages and their trust.

Three further cases that deliberately do **not** return `eligible`:

- **No conditions recorded.** An empty `all` means nobody has entered the criteria yet, not
  that everyone qualifies.
- **An unsupported predicate.** The result explains which type could not be evaluated.
- **A malformed or future-versioned document.** Same treatment.

## Answer coercion

| Given | Treated as |
|---|---|
| `19`, `"19"`, `" 19 "`, `19.0` | the number 19 |
| `true`, `"yes"`, `"y"`, `"1"` | boolean true |
| `false`, `"no"`, `"n"`, `"0"` | boolean false |
| `"up"` against `["UP"]` | a match |
| `true` where a number is expected | **unknown**, not 1 |
| `"abc"`, `""`, `null`, `[]`, `{}` where a number is expected | unknown |

That penultimate row matters more than it looks. In Python `True == 1`, so an age answered as
`true` would silently become 1 and quietly fail an `age_min` check as though the citizen had
answered. The evaluator rejects `bool` for numeric facts for exactly this reason.

## Safety properties

1. **No code execution.** No `eval`, no `exec`, no callables from data. A rule is data and the
   evaluator is a fixed set of predicates. Scheme rows are operator-supplied content and must
   never be able to run anything.
2. **No language model.** A model may help *author* a rule offline. It never evaluates one.
3. **Deterministic.** Same answers plus same `rules_version` always give the same result, which
   is what makes the `rules_version` on every response meaningful.
4. **Strictly validated.** `extra="forbid"` everywhere, so a typo like `"valu": 18` is rejected
   rather than silently ignored — a silently ignored condition is an invisible wrong answer.
5. **Explained.** Every condition reports met / failed / unknown with a sentence a person can
   read. The API never returns a bare verdict.

## Versioning

`rules_version` on the scheme row is **bumped whenever `eligibility_rules` changes**, and every
eligibility response carries it. That is what lets a past result be reproduced and audited.

The format itself is versioned separately by the `version` key inside the document. A document
declaring an unknown format version is refused rather than interpreted optimistically.

## Adding a predicate

1. Add a class in `rules.py` with a `Literal` `type` and a `describe()` method.
2. Add it to the `Condition` union, `SUPPORTED_TYPES`, and `FACT_KINDS`.
3. Handle it in `_evaluate_condition` in `engine.py`.
4. Add tests: met, failed, unknown, and the boundary value.

That is the whole extension path. If you find yourself writing `if scheme.slug == ...`
anywhere, the rule format is missing a predicate — add the predicate instead.

## What the format cannot express yet

Honest limitations, not oversights:

- No `any` / `or`, and no nesting.
- No comparison between two facts (`income < spouse_income`).
- No dates or durations ("resident for 3 years").
- No "at least N of these".
- No units on income — the integer is assumed to be rupees per year, by convention only.

A scheme needing any of these cannot be represented faithfully today. Record it in
`research-register.md` with the gap noted, and leave it unverified, rather than approximating
the criteria and shipping a rule that is subtly wrong.
