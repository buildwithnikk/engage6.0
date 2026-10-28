# API contracts

Base URL: `${NEXT_PUBLIC_API_BASE_URL}` (local default `http://localhost:8000`)
All endpoints are versioned under `/api/v1`. All bodies are JSON.

Interactive docs while the backend runs: `http://localhost:8000/docs`

| Endpoint | Method | Status |
|---|---|---|
| `/api/v1/health` | GET | **Implemented (Phase 0)** |
| `/api/v1/schemes` | GET | Planned — Phase 1 |
| `/api/v1/schemes/{slug}` | GET | Planned — Phase 1 |
| `/api/v1/eligibility/check` | POST | Planned — Phase 1 |

Only the health endpoint exists. The planned rows below are a design sketch, deliberately not
registered in the router — `backend/tests/integration/test_health.py` asserts that
`/api/v1/schemes` and `/api/v1/eligibility` return 404, so Phase 1 cannot start by accident.

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

## Planned — Phase 1 (not implemented)

Sketches only, recorded so the frontend types and the Python services are designed against the
same shape. None of this is registered, and nothing should be built against it until Phase 1
opens in `phase-plan.md`.

### GET /api/v1/schemes

Lists **verified** schemes only (`review_status = 'verified'`).

Query: `state_code`, `q`, `limit` (default 20, max 100), `offset`.

```json
{
  "items": [
    {
      "slug": "example-scheme",
      "official_name": "…",
      "department": "…",
      "jurisdiction": "central",
      "state_code": null,
      "benefit_summary": "…",
      "required_documents": ["…"],
      "official_apply_url": "https://…gov.in/…",
      "source_url": "https://…gov.in/…",
      "verified_at": "2026-01-01T00:00:00Z",
      "rules_version": "1"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

`eligibility_rules` is not exposed in the list response. Rules are an implementation detail of
the engine; publishing them invites clients to reimplement eligibility and disagree with us.

### POST /api/v1/eligibility/check

**Stateless.** The answer is computed from the request body and nothing is persisted — no
profile row, no answer row. See `privacy.md`.

```json
{
  "answers": { "age": 37, "annual_income": 96000, "state_code": "UP", "category": "OBC" },
  "scheme_slugs": ["example-scheme"]
}
```

```json
{
  "rules_version": "1",
  "evaluated_at": "2026-01-01T00:00:00Z",
  "results": [
    {
      "slug": "example-scheme",
      "outcome": "eligible",
      "matched": ["annual_income <= 250000", "state_code == UP"],
      "unmet": [],
      "missing_answers": [],
      "missing_documents": ["income_certificate"]
    }
  ],
  "disclaimer": "Indicative only. Not an official eligibility determination."
}
```

`outcome` is `eligible | not_eligible | insufficient_information`. The third value matters:
a missing answer must never be silently treated as a pass or a fail.

**Design rules carried into Phase 1**

1. Eligibility is evaluated by deterministic Python rules, never by a language model.
2. Every response states its `rules_version`, so a result can be reproduced.
3. `matched` and `unmet` make the outcome explainable rather than an opaque verdict.
4. The disclaimer is part of the contract, not UI decoration.
