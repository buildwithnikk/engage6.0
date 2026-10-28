# Phase plan

**Active phase: Phase 2 ✅ complete.** Every later phase is gated. A phase opens only when the previous
phase's definition of done is demonstrably met — not when it looks nearly done, and not because
a later phase would be more interesting to build.

No phase below Phase 0 may be started implicitly. "While I was in there I also added…" is how a
foundation stops being trustworthy.

---

## Phase 0 — Foundation ✅ complete

**Goal:** prove the Next.js → FastAPI path works, and write down the contracts and risks the
rest of the project depends on.

**In scope**
- Repository structure: `frontend/`, `backend/`, `docs/`, `supabase/`, CI
- FastAPI app: typed settings, versioned `/api/v1` router, configurable CORS
- `GET /api/v1/health` reporting the real database state
- Optional, lazy database check — the app starts without credentials
- Next.js landing page with a live backend/database status panel and a retry
- Typed API client and hand-written API types
- Backend tests; frontend type-check and production build
- `.env.example` files, `.gitignore`, documentation
- Supabase Free-tier limits and the RLS-bypass risk, documented

**Definition of done** — the checklist in the root `README.md`. All ten items.

**Explicitly not in Phase 0:** scheme endpoints, eligibility engine, LLM calls, OCR, document
upload, PDF generation, voice, translation, complaints, maps, QR passes, dashboards, offline
sync, profile persistence, production deployment.

---

## Phase 1 — Scheme catalogue and eligibility ✅ active

**Opened:** Phase 0's checklist passed and the health endpoint reports `database: "ok"`
against local PostgreSQL. A Supabase project is **not** a prerequisite for Phase 1; it is a
prerequisite for the first deployment.

**Delivered**
- `supabase/migrations/20261028120000_create_schemes.sql` — the `schemes` table, its
  constraints, indexes and `updated_at` trigger, with a matching `.down.sql`
- SQLAlchemy model, repository, service and thin routes
- `GET /api/v1/schemes`, `GET /api/v1/schemes/{scheme_id}` (UUID **or** slug),
  `POST /api/v1/eligibility/check`
- Deterministic rule evaluator — see [eligibility-rules.md](eligibility-rules.md)
- Idempotent synthetic seed that cannot write `verified`
- Next.js discovery, detail and questionnaire pages against the real API
- 121 backend tests

**Scope note:** Phase 1 absorbed what the original plan called Phase 2 (the eligibility
engine), because a catalogue with no eligibility check is not a usable vertical slice. The
numbering below shifts accordingly.

**Scope**
- Research and verify a first set of schemes using `research-register.md` — each one checked
  against the responsible department's own source, not only myScheme
- First migration in `supabase/migrations/`: `schemes` + its RLS policy, reviewed before it is applied
- SQLAlchemy model mapping that table
- `GET /api/v1/schemes` and `GET /api/v1/schemes/{slug}`, verified rows only
- Frontend: a scheme list and detail page, real data only
- Tests: unit tests for the repository layer, integration tests for both endpoints

**Done when:** the frontend lists real verified schemes from Supabase, every row traces to an
official source with a reviewer and a date, and no unverified row is reachable by a browser client.

**Still excluded:** eligibility evaluation, AI, documents.

---

## Phase 2 — Admin Dashboard & Scheme Curation ✅ complete

**Delivered**
- Migration `supabase/migrations/20261028130000_create_admin_and_audit.sql`: `admin_users`,
  `admin_sessions` and `audit_events`.
- Secure admin authentication (Argon2 via `pwdlib[argon2]`, revocable sessions, HttpOnly cookies,
  CSRF header protection, Origin verification, and rate limiting).
- Role-based authorization (`editor`, `reviewer`, `admin`) enforced strictly in FastAPI dependencies.
- Deterministic scheme review state machine: `draft` → `needs_review` → `verified` / `archived`,
  with changes requested reason tracking in audit trail.
- Verification invalidation: editing any verified scheme automatically demotes it to `needs_review`
  and removes it immediately from public endpoints.
- Optimistic concurrency protection against stale concurrent edits (HTTP 409 Conflict).
- Next.js responsive admin interface: `/admin/login`, `/admin` (overview), `/admin/schemes` (list/filter),
  `/admin/schemes/new` (draft creator), `/admin/schemes/[id]` (inspect/edit/verify), and `/admin/audit` (audit log).
- CLI bootstrap command `python -m app.cli create-admin` for secure first-admin initialization.
- Full unit and integration test suite passing against local PostgreSQL.

---

## Phase 3 — Document understanding 🔒 gated

OCR and document-field extraction, in Python. Private Storage bucket with size limits, ownership
checks, consent and deletion. Postgres holds metadata only.

**Prerequisite that cannot be skipped:** the data-isolation test in `database-schema.md` §4 must
pass before any private user data is stored. Synthetic documents only during development.

---

## Phase 4 — Accounts and saved data 🔒 gated

Supabase Auth, `profiles` referencing `auth.users`, saved schemes, `audit_events`. One explicit
access-control approach, chosen and tested: User A must not be able to read or modify User B's
rows.

---

## Phase 5 — Multilingual delivery 🔒 gated

Translation and voice. Python owns translation services; TypeScript owns only the
browser-native speech capabilities.

---

## Phase 6 — Civic complaints 🔒 gated

Complaint capture, routing, status tracking and escalation. Depends on accounts or on a
deliberate anonymous model, and on the offices directory.

---

## Later, unscheduled

Maps and routing · QR passes · analytics dashboards · offline sync · production deployment and
monitoring.

---

## Rules for moving between phases

1. A gated phase stays closed until the previous phase's definition of done is met.
2. Do not create a folder, table, endpoint or dependency for a phase that has not opened.
3. If a phase's work reveals that an earlier decision was wrong, fix the earlier phase and
   update the documents — do not work around it in the new phase.
4. Every phase ends with the tests and the build passing, and the documents agreeing with the code.
5. No phase ships a feature that fabricates data. A missing capability is stated, never simulated.
