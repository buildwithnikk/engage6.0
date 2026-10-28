# API contracts

Base URL: `${NEXT_PUBLIC_API_BASE_URL}` (local default `http://localhost:8000`)
All endpoints are versioned under `/api/v1`. All bodies are JSON.

Interactive docs while the backend runs: `http://localhost:8000/docs`

| Endpoint | Method | Status |
|---|---|---|
| `/api/v1/health` | GET | **Implemented (Phase 0)** |
| `/api/v1/schemes` | GET | **Implemented (Phase 1)** |
| `/api/v1/schemes/{scheme_id}` | GET | **Implemented (Phase 1)** — accepts UUID *or* slug |
| `/api/v1/eligibility/check` | POST | **Implemented (Phase 1)** |

That is the whole public API.
`backend/tests/integration/test_health.py::test_openapi_documents_exactly_the_phase_1_surface`
asserts this exact list, so a new endpoint cannot appear without the list changing — and
`test_no_phase_2_endpoint_is_exposed_yet` asserts that `/documents`, `/complaints`, `/profiles`
and `/auth` still 404.

**The visibility rule, which applies to all three scheme endpoints:** a public caller sees
`review_status = 'verified'` records only. Draft and needs-review rows are unchecked research.
A hidden record returns **404**, never 403, so a caller cannot distinguish "exists but hidden"
from "does not exist".

---

## GET /api/v1/health — implemented

Liveness of the API, plus the **real** state of its database connection.

**Request:** no parameters, no body, no authentication.

**Response `200 OK`**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "unconfigured",
  "detail": "DATABASE_URL is not set."
}
```

| Field | Type | Meaning |
|---|---|---|
| `status` | `"ok"` | The API process is alive. If it were not, there would be no response. |
| `version` | string | `app_version` from backend settings. |
| `database` | `"ok" \| "unconfigured" \| "unavailable"` | See below. |
| `detail` | string \| null | Short, non-sensitive reason when `database` is not `ok`. Never contains a connection string, credential or stack trace. |

### The three database states

| Value | Meaning | How it is produced |
|---|---|---|
| `unconfigured` | No `DATABASE_URL` is set. **Nothing was attempted.** | Settings check only |
| `ok` | A connection was opened and `SELECT 1` succeeded. | Real query |
| `unavailable` | A `DATABASE_URL` is set, but connecting or querying failed. | Caught exception; class name only |

There is no fourth "assume healthy" state. `ok` is returned only after a successful query — the
endpoint never claims the database is healthy without checking.

### Status codes

| Code | When |
|---|---|
| `200` | Always, while the process is alive — including when the database is `unavailable`. |
| `405` | Wrong method. |
| `404` | Unknown path, including every Phase 1 path. |

**Why a dead database still returns 200:** "the API is up" and "the database is reachable" are
different facts, and the response carries both. Returning 503 would make the API itself look
down and would hide the distinction the frontend needs in order to tell the user the truth.
A future readiness probe for an orchestrator, if one is needed, belongs at a separate path.

### Performance

The database check runs per request with `DB_CONNECT_TIMEOUT` (default 3s). Unconfigured
responses are immediate. The frontend client applies its own 5s timeout.

### CORS

| Setting | Value |
|---|---|
| Allowed origins | `CORS_ALLOW_ORIGINS`, comma-separated. Default `http://localhost:3000,http://127.0.0.1:3000` |
| Allowed methods | `GET, POST, PATCH, DELETE, OPTIONS` |
| Allowed headers | `Authorization, Content-Type` |
| Credentials | `CORS_ALLOW_CREDENTIALS`, default `false` |

A wildcard origin forces credentials **off** in `core/config.py`. Browsers reject that pairing
and serving it would be a genuine cross-origin risk, so the configuration cannot express it.
Add the deployed frontend origin to `CORS_ALLOW_ORIGINS` when deploying; do not use `*`.

### Client behaviour

`frontend/src/lib/api-client.ts` classifies every failure and never substitutes mock data:

| Kind | Cause | UI shows |
|---|---|---|
| `config` | `NEXT_PUBLIC_API_BASE_URL` missing | "Frontend not configured" |
| `network` | Unreachable, DNS failure, CORS block, or 5s timeout | "Backend unreachable" + the uvicorn command |
| `http` | Non-2xx | "Backend error" with the status |
| `invalid` | 2xx body that fails `isHealthResponse` | "Unexpected response" |

In every error case the UI states that database status is **unknown**, because the API could not
be asked.

### Verify by hand

```bash
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

```bash
# CORS preflight from the Next.js origin
curl -s -i -X OPTIONS http://localhost:8000/api/v1/health \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: GET' | head -12
```

---

## GET /api/v1/schemes — implemented

**Query parameters**

| Name | Type | Default | Notes |
|---|---|---|---|
| `q` | string ≤100 | — | Free text over official name, benefit summary and department. LIKE wildcards in the input are escaped, so `%` searches for a percent sign. |
| `jurisdiction` | `central` \| `state` | — | 422 on any other value. |
| `state_code` | string ≤10 | — | Case-insensitive. **Also returns central schemes**, which apply everywhere — hiding them would mislead. |
| `review_status` | enum | — | Can only *narrow* the public set. Asking for `draft` without permission returns an empty page, not a 403. |
| `page` | int ≥1 | 1 | |
| `page_size` | int 1–100 | 20 | 422 outside the range. |

**Response `200`**

```json
{
  "items": [
    {
      "id": "0e37df36-f698-11e6-8dd4-cb9ced3df976",
      "slug": "demo-study-support-allowance",
      "official_name": "DEMO — Study Support Allowance (synthetic sample)",
      "department": "Demo Department of Education (fictional)",
      "jurisdiction": "state",
      "state_code": "UP",
      "benefit_summary": "SYNTHETIC DEMO RECORD. Illustrative only.",
      "required_documents": ["Identity proof (demo)"],
      "official_apply_url": null,
      "source_url": "https://example.gov.in/synthetic-demo-scheme",
      "review_status": "draft",
      "verified_at": null,
      "rules_version": "1"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

Ordering is `official_name, id` — the `id` tiebreak gives a total order, without which a row
can appear on two pages or on none.

`eligibility_rules` is **not** exposed. Rules belong to the evaluator; publishing them invites
clients to reimplement eligibility and then disagree with us.

```bash
curl -s "http://localhost:8000/api/v1/schemes?q=allowance&page_size=5" | python3 -m json.tool
```

---

## GET /api/v1/schemes/{scheme_id} — implemented

`scheme_id` is a **UUID or a slug**. (Phase 0 sketched `{slug}` and the Phase 1 brief said
`{scheme_id}`; accepting both reconciles them.)

Returns a `SchemeSummary` plus:

| Field | Meaning |
|---|---|
| `required_facts` | The questions the eligibility check needs: `{fact, kind, requirements[], choices[]}`. Drives the questionnaire, so the client never hardcodes rule vocabulary. |
| `rules_readable` | `false` when this build cannot parse the stored rules. The UI then explains instead of showing a form. |

`404` when no such scheme exists **or** it is not publicly visible.

```bash
curl -s http://localhost:8000/api/v1/schemes/demo-study-support-allowance | python3 -m json.tool
```

---

## POST /api/v1/eligibility/check — implemented

**Stateless.** Answers are used to compute the response and then discarded — no row written,
no answer logged. `tests/integration/test_eligibility_api.py::TestStatelessness` asserts it,
including that no table exists which *could* hold answers.

**Request**

```json
{
  "scheme_id": "demo-study-support-allowance",
  "answers": { "age": 19, "annual_income": 96000, "state_code": "UP", "is_student": true }
}
```

`extra="forbid"`: an unknown top-level field is a 422, so a client cannot quietly ask for
something the contract does not offer. Omit a fact the citizen has not answered — do not send
an empty string, because absent and blank must stay distinguishable.

**Response `200`**

```json
{
  "scheme_id": "0e37df36-f698-11e6-8dd4-cb9ced3df976",
  "scheme_slug": "demo-study-support-allowance",
  "official_name": "DEMO — Study Support Allowance (synthetic sample)",
  "outcome": "needs_more_information",
  "summary": "We cannot decide yet. 2 questions still unanswered.",
  "met": [
    {
      "fact": "age", "type": "age_min", "status": "met",
      "requirement": "Age must be at least 16",
      "explanation": "You are 19; the minimum is 16."
    }
  ],
  "failed": [],
  "unknown": [],
  "missing_facts": ["annual_income", "state_code"],
  "rules_version": "1",
  "source_url": "https://example.gov.in/synthetic-demo-scheme",
  "official_apply_url": null,
  "review_status": "draft",
  "evaluated_at": "2026-10-28T12:00:00+00:00",
  "disclaimer": "This is an informational estimate ... not an official decision."
}
```

`outcome` is `eligible`, `ineligible` or `needs_more_information`. The third is returned when
a required fact is missing, when the rules cannot be read, and when a scheme has no rules
recorded. **A missing answer is never treated as a pass.** Full semantics:
[eligibility-rules.md](eligibility-rules.md).

| Code | When |
|---|---|
| `200` | Evaluated, including the `needs_more_information` case |
| `404` | No such scheme, or not publicly visible |
| `422` | Malformed body, unknown field, or a non-scalar answer value |
| `503` | `DATABASE_URL` is not configured — stated plainly rather than returning an empty catalogue |

```bash
curl -s -X POST http://localhost:8000/api/v1/eligibility/check \
  -H 'content-type: application/json' \
  -d '{"scheme_id":"demo-study-support-allowance","answers":{"age":19}}' | python3 -m json.tool
```

---

## Planned — later phases (not implemented)

Documents, complaints, profiles and authentication are gated in
[phase-plan.md](phase-plan.md). Nothing is registered for them, and a test asserts those paths
return 404.
