# Scheme research register

Owner: **Person B.** Every scheme entering the catalogue passes through this template first.

**The rule that matters:** [myScheme](https://www.myscheme.gov.in/) is a *discovery* starting
point only. A scheme is not enabled until its facts are verified against the **responsible
department's own official source**. A scheme that cannot be verified that way stays
`needs_review` and is never shown to a user.

A wrong eligibility rule tells a citizen they qualify when they do not. That costs them a trip,
a day's wages and their trust. It is the most harmful defect this project can ship, so
verification is a gate rather than a nicety.

---

## Template

Copy one block per scheme.

```markdown
### <working title>

| Field | Value |
|---|---|
| Official scheme name | *exactly as the department publishes it* |
| Slug | `lower-kebab-case`, stable, never reused |
| Responsible department | *ministry / department / directorate* |
| Jurisdiction | `central` \| `state` |
| State code | *required when state; blank when central* |
| Eligibility requirements | *each criterion on its own line, as published* |
| Benefits | *amount, frequency, or in-kind benefit, as published* |
| Required documents | *as the application actually demands* |
| Official application URL | *the page where a citizen applies* |
| Source URL | *the department page the facts were read from* |
| Date checked | `YYYY-MM-DD` |
| Reviewer | *name of the person who checked it* |
| Verification status | `draft` \| `needs_review` \| `verified` \| `rejected` |
| Rules version | `1`, bumped whenever the rules change |
| Notes / ambiguities | *anything unclear, contradictory or out of date* |
```

---

## Field rules

| Field | Rule |
|---|---|
| Official scheme name | Copy it; do not tidy or translate it. Citizens search for the official string. |
| Slug | Stable forever — it is a public identifier. Never reuse a retired slug. |
| Jurisdiction / state code | A state scheme must carry its state code. A central scheme must not. |
| Eligibility requirements | Record what is **published**, not what seems reasonable. Note contradictions instead of resolving them yourself. |
| Benefits | Record the unit: per year, per month, one-time, or in kind. "₹6,000" with no period is unusable. |
| Required documents | What the application demands, which is often more than the eligibility text implies. |
| Application URL vs source URL | They differ often. Both are required. |
| Date checked | Schemes change, and income limits change most. A stale check is a wrong check. |
| Reviewer | A named person. "AI-generated" is not a reviewer. |
| Verification status | Only a human sets `verified`, only after reading the official source. |

---

## Verification workflow

1. **Discover** — find a candidate on myScheme or a department site.
2. **Locate the official source** — the responsible department's own page. A portal summary is
   not a source.
3. **Read the primary text** — the scheme guidelines, notification or GO where one exists.
4. **Fill the block** with the department's wording.
5. **Draft the rules** — a machine-readable form of the eligibility text. A model may draft
   this; a human reads **every line**.
6. **Check the ambiguities** — missing income definition? household vs individual? unstated
   age boundary? Record it rather than guessing.
7. **Set the status.** `verified` means: an identified person read the official source on the
   recorded date and the rules match it.
8. **Review** — a second person spot-checks the rules against the source before the scheme goes
   live.

### What blocks verification

- The only source is an aggregator, a news article or a PDF of unclear origin
- The published eligibility text is self-contradictory
- Income thresholds carry no definition of income
- The scheme appears discontinued or superseded
- The application URL is dead

Any of these → `needs_review`, with the reason in Notes.

---

## Rules format — outline only

The concrete rule format is designed at the start of Phase 2, with the engine. Recorded now so
research does not have to be redone:

- **Deterministic.** Same answers plus same `rules_version` → same outcome, always.
- **Explainable.** Each criterion is individually reportable as met or unmet; the engine returns
  `matched` and `unmet` rather than a bare verdict.
- **Three-valued.** A missing answer yields `insufficient_information`, never a silent pass or
  fail.
- **Typed inputs.** Each criterion names the answer it needs (`age`, `annual_income`,
  `state_code`, `category`) and that answer's type.
- **Versioned.** Any change to a rule bumps `rules_version`, so a past result stays reproducible.
- **No model in the path.** A language model may help author a rule. It never evaluates one.

---

## Synthetic test scenarios

Person B's Phase 0 deliverable. Scenarios are **synthetic** — invented people, never a real
citizen's data (see `privacy.md`).

```markdown
### Scenario: <name>

| Field | Value |
|---|---|
| Answers | `{ "age": 37, "annual_income": 96000, "state_code": "UP", "category": "OBC" }` |
| Scheme | `<slug>` |
| Expected outcome | `eligible` \| `not_eligible` \| `insufficient_information` |
| Expected unmet | *which criteria should come back unmet* |
| Why this scenario exists | *the boundary or branch it covers* |
```

Coverage to aim for, before the engine exists:

| Category | Why it must be covered |
|---|---|
| Clearly eligible | The happy path |
| Clearly ineligible | One criterion decisively fails |
| **Boundary values** | Income exactly at the limit; age exactly at the limit. Off-by-one here is the most likely real bug. |
| Missing answer | Must be `insufficient_information`, not a guess |
| Wrong state | A state scheme must reject out-of-state applicants |
| Eligible but missing a document | Eligible, with `missing_documents` populated |
| Multiple failures | `unmet` lists all of them, not just the first |
| Malformed input | Negative income, future date of birth, unknown category |

---

## How a record reaches the public catalogue

1. Researched and filled in here, with a source URL, a date and a named reviewer.
2. Rules authored in the format in [eligibility-rules.md](eligibility-rules.md) and read line
   by line by a human.
3. A second person spot-checks the rules against the official source.
4. Promoted to `review_status = 'verified'` with a `verified_at` date, through a reviewed
   migration or an admin path.

**Never through the seed.** `backend/app/seed.py` raises if a record claims `verified`, and the
database constraint `schemes_verified_requires_date` refuses a verification with no date. Both
exist because a forged provenance claim is worse than a missing scheme.

## Register

**No scheme has been verified.** The catalogue currently holds four synthetic demo records,
which are deliberately unverified and therefore invisible to the public API.

| Slug | Official name | Jurisdiction | Status | Checked | Reviewer |
|---|---|---|---|---|---|
| `demo-study-support-allowance` | DEMO — Study Support Allowance | state (UP) | draft — **synthetic** | — | — |
| `demo-artisan-equipment-grant` | DEMO — Artisan Equipment Grant | central | draft — **synthetic** | — | — |
| `demo-senior-travel-concession` | DEMO — Senior Travel Concession | state (UP) | needs_review — **synthetic** | — | — |
| `demo-unreadable-rules-fixture` | DEMO — Scheme With Unsupported Rules | central | draft — **synthetic** | — | — |

### What must happen before any real scheme appears

No internet research against official government sources has been done in this phase, so no
real scheme has been entered, and none has been cited. Phase 2 is where a person:

- identifies candidate schemes and locates each responsible department's own page,
- records the published criteria verbatim, with the URL and the date checked,
- authors and hand-checks the rules,
- and signs off as reviewer.

Until then the public catalogue is empty, which is the correct and honest state.
