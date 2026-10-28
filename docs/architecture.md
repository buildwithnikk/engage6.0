# Architecture

**Status:** Phase 2 active. Scheme catalogue, deterministic eligibility engine, admin authentication, scheme curation, and audit trail are implemented.

```
React + Next.js (App Router) + TypeScript
        │  fetch, typed client, credentials: "include", JSON only
        ▼
Python FastAPI  ──────────────── owns ALL domain logic, auth, AI, OCR, integrations
        │  SQLAlchemy 2.x + psycopg
        ▼
PostgreSQL
        │  local in development · Supabase Free tier in deployment
        │
        ├── Verified scheme catalogue  →  Deterministic Python eligibility engine
        └── Admin curation dashboard   →  Argon2 auth, session tokens, audit logging
```

## The division of responsibility

**TypeScript owns the UI and browser capabilities only.** Rendering, routing, accessibility,
form interaction, and later the browser-native capabilities (camera, speech, geolocation,
offline storage) that must run on the device.

**Python owns everything else.** Scheme data, eligibility rules, OCR, translation, AI calls,
database access, and third-party integrations.

This boundary is a hard rule, not a preference:

- A Next.js route handler must not contain business logic. If logic needs a server, it belongs
  in FastAPI.
- Eligibility must be deterministic and auditable. It lives in one Python service so a given
  profile and a given rules version always produce the same answer, and that answer can be
  explained and tested.
- Secrets (database URL, service-role key, AI provider keys) live only in the backend
  environment. They never reach the browser bundle.

### Why not implement the logic in Next.js route handlers

It would work, and it would be faster to write. It is rejected because eligibility
determination is the part of this system that must be testable, reviewable and reproducible,
and because AI, OCR and database work all belong in one language with one set of tests. Splitting
business logic across two runtimes is how a project ends up with two half-correct
implementations of the same rule.

## Request path, as implemented in Phase 0

```
app/page.tsx (server component)
  └── features/system/BackendStatus.tsx   "use client"
        └── lib/api-client.ts   getHealth()
              │  GET ${NEXT_PUBLIC_API_BASE_URL}/api/v1/health
              │  AbortController, 5s timeout, cache: "no-store"
              ▼
        FastAPI  app/main.py  → CORSMiddleware → /api/v1 router
              └── api/v1/health.py
                    └── db/session.py  check_database(settings)
                          ├── no DATABASE_URL        → ("unconfigured", reason)
                          ├── SELECT 1 succeeds      → ("ok", None)
                          └── connection/query fails → ("unavailable", exception class name)
              ▲
              │  200 { status, version, database, detail }
        api-client validates the shape (isHealthResponse) before the UI trusts it
              ▲
        BackendStatus renders API state and database state separately
```

Two states are reported, never merged. "API reachable, database unconfigured" is the normal
Phase 0 condition and the UI says exactly that.

## Folder responsibilities

| Path | Responsibility | Owner |
|---|---|---|
| `frontend/src/app/` | App Router routes, layout, global styles | A |
| `frontend/src/components/layout/` | Presentational shell (header, footer) | A |
| `frontend/src/features/admin/` | Admin auth context, navbar, status badges, guard | A |
| `frontend/src/features/schemes/` | Scheme list, detail, eligibility questionnaire | A |
| `frontend/src/features/system/` | The system-status feature | A |
| `frontend/src/lib/api-client.ts` | The **only** place that knows the backend URL and performs fetches | A |
| `frontend/src/types/api.ts` | Hand-written mirrors of the backend schemas | A + C |
| `backend/app/main.py` | App factory, CORS, router registration | C |
| `backend/app/core/config.py` | Typed settings from the environment | C |
| `backend/app/api/v1/` | Thin HTTP routes (health, schemes, eligibility, admin). | C |
| `backend/app/schemas/` | Pydantic request/response models | C |
| `backend/app/db/session.py` | Database access & session fixtures | C |
| `backend/app/services/` | Domain logic: scheme catalogue, eligibility, admin auth, curation | B |
| `backend/tests/unit/` | No I/O, no network (unit tests) | B + C |
| `backend/tests/integration/` | Through the ASGI app with TestClient | C |
| `supabase/migrations/` | The single canonical migration history | C |
| `docs/` | Shared contracts and decisions, reviewed by all three | all |
| `prototype/` | **Superseded.** Earlier Next.js-only prototype, excluded from the build. | — |

## Component boundaries

- `api-client.ts` is the single network seam. No component calls `fetch` directly, so timeout,
  error classification and response validation exist in exactly one place.
- `types/api.ts` is the contract. It is hand-written to mirror `backend/app/schemas/`; if a
  backend schema changes, both change in the same commit.
- A feature folder (`features/system/`) owns its own data fetching and its own loading, error and
  empty states. Layout components stay presentational and take no data.
- FastAPI routes unwrap the request, call a function, and return a Pydantic model. `health.py`
  is 15 lines for this reason, and Phase 1 routes should look the same.

## Error-handling strategy

**Principle: report the real state. A degraded truthful answer always beats a reassuring guess.**

| Layer | Rule |
|---|---|
| `check_database` | Never raises. Returns a 3-state status. Catches broadly because a health probe must not propagate anything. |
| Credential safety | Only the exception *class name* is logged or returned. Driver messages routinely contain host, user and password, so the message is never surfaced. |
| Health endpoint | Always HTTP 200 when the process is alive. The database's state is data in the body, not an HTTP status — the API being up and the database being down are different facts. |
| Future endpoints | A failed dependency gives 503 with a non-sensitive message; a bad request gives 422 via Pydantic. No endpoint returns fabricated data on failure. |
| `api-client` | Classifies every failure as `config`, `network`, `http` or `invalid`, with a 5s timeout. Validates the body before returning it. Never substitutes mock data. |
| UI | Separate loading, ready and error states; every error offers a retry; when the API is unreachable the UI says database state is *unknown* rather than guessing. |
| Build | Phase 0 keeps type and lint errors fatal. The prototype's `ignoreBuildErrors` is not carried over. |

## Security boundaries

| Boundary | Rule |
|---|---|
| Secrets | `DATABASE_URL`, service-role keys, JWT secrets and AI provider keys exist only in the backend environment. Never in `frontend/`, never in a `NEXT_PUBLIC_*` variable. |
| `NEXT_PUBLIC_API_BASE_URL` | Public by design — a URL, not a credential. It is the only backend-related value the browser sees. |
| CORS | Explicit origins from `CORS_ALLOW_ORIGINS`. A wildcard origin forces credentials off in `config.py`; the combination is never served. |
| Error output | No stack trace, SQL or connection string crosses the API boundary. |
| Privileged database connection | The backend's connection is privileged and **bypasses Row Level Security**. See `database-schema.md` before putting per-user data behind it. |
| Document binaries | Not stored in Postgres. Not stored at all in Phase 0. |
| Real citizen documents | Never used in development or tests. Synthetic data only — see `privacy.md`. |
| Eligibility output | Indicative, never an official determination. The UI must say so wherever a result appears. |

## Integration points

| Integration | State | Notes |
|---|---|---|
| Frontend → FastAPI | **Implemented** | `GET /api/v1/health` |
| FastAPI → PostgreSQL | **Verified against local Postgres 16.15** | Lazy and optional; the app starts without it. Supabase (deployment) not yet exercised. |
| Supabase Auth | Planned | Not in Phase 0. JWT verification approach to be chosen and tested before any private table exists. |
| Supabase Storage | Planned | Private buckets only, when document storage is implemented |
| AI / OCR providers | Planned | Python-side only; no provider key ever reaches the browser |
| Scheme sources | Research only | See `research-register.md` |
