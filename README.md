# Sahayak

A multilingual citizen-assistance platform for discovering government schemes, checking
eligibility, understanding official documents and preparing forms.

**Current phase: Phase 1 — scheme catalogue and eligibility.** The first vertical slice works
end to end: Next.js discovery page → FastAPI → PostgreSQL → deterministic Python evaluator →
an explained result. Later phases are gated in [`docs/phase-plan.md`](docs/phase-plan.md).

**The public catalogue is empty until real schemes are verified.** Seeded records are synthetic
and deliberately unverified, so they are hidden from public responses. That is the design, not
a bug — see "Seed data" below.

```
React + Next.js + TypeScript  →  Python FastAPI  →  Supabase PostgreSQL
                                        ↓
                      verified scheme catalogue → deterministic eligibility engine
```

Python owns all domain logic, AI, OCR and database access. TypeScript owns the UI and
browser capabilities only.

---

## Run it locally

Two terminals. Backend first.

### 1. Backend — FastAPI

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/api/v1/health
- Interactive docs: http://localhost:8000/docs

`DATABASE_URL` may stay blank. The app starts without it and reports
`database: "unconfigured"`, which is the correct Phase 0 state.

### 2. Database — migrate and seed

```bash
./scripts/db.sh migrate     # apply supabase/migrations (idempotent)
./scripts/db.sh seed        # insert synthetic demo schemes (idempotent)
```

```bash
./scripts/db.sh rollback    # drop the catalogue (asks for confirmation)
./scripts/db.sh reset       # rollback + migrate + seed
./scripts/db.sh test-db     # create/refresh the isolated test database
./scripts/db.sh psql        # shell on the development database
```

### 3. Frontend — Next.js

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000/schemes.

### Verify

```bash
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

```bash
cd backend && source .venv/bin/activate && pytest     # 121 tests
```

```bash
# The catalogue, through the real API
curl -s "http://localhost:8000/api/v1/schemes" | python3 -m json.tool
curl -s "http://localhost:8000/api/v1/schemes/demo-study-support-allowance" | python3 -m json.tool
```

```bash
# An eligibility check (nothing is stored)
curl -s -X POST http://localhost:8000/api/v1/eligibility/check \
  -H 'content-type: application/json' \
  -d '{"scheme_id":"demo-study-support-allowance","answers":{"age":19,"annual_income":96000,"state_code":"UP","is_student":true}}' \
  | python3 -m json.tool
```

```bash
cd frontend && npm run typecheck && npm run build
```

---

## Database: local for development, Supabase for deployment

Development runs against **local PostgreSQL**. Supabase is the **deployment** target. Keeping
them separate means no developer needs cloud credentials, nobody shares a database, and the
Free-tier limits and pausing never affect day-to-day work.

`DATABASE_URL` is a **secret** either way. It belongs in `backend/.env` only — never in
`frontend/`, never in a `NEXT_PUBLIC_*` variable, never committed. `.gitignore` excludes `.env`.

### Local development

```bash
brew install postgresql@16 && brew services start postgresql@16
```

```bash
./scripts/setup-local-db.sh
```

The script creates the `sahayak_app` role and the `sahayak_dev` database, then writes
`DATABASE_URL` into `backend/.env`. It never prints the password, and it is safe to re-run
(re-running rotates the password, so restart uvicorn afterwards).

The role is deliberately **not** a superuser and does **not** have `BYPASSRLS`, so local
development behaves like the deployed setup rather than silently skipping every policy.

Restart the backend and reload the page — the status panel should show **Connected**.

### Deployment (later)

1. Create a project at [supabase.com](https://supabase.com) (Free tier).
2. Dashboard → **Connect**, copy the exact string — the pooler host cannot be guessed.
3. Prefer the **session pooler** (port 5432, user `postgres.[PROJECT-REF]`). The direct
   connection is **IPv6-only** on Free tier, so it fails on an IPv4-only network.
4. Add the `+psycopg` prefix and percent-encode `&`, `#`, `?` or spaces in the password:

```
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres
```

5. Set it in the **deployment environment**, not in a file in the repository.

The same migrations in `supabase/migrations/` apply to both.

Full detail, including export and restore: [`docs/database-schema.md`](docs/database-schema.md) §7.

---

## Seed data, and why the catalogue looks empty

`./scripts/db.sh seed` inserts four **synthetic** schemes. Every one is invented: slugs start
with `demo-`, names start with `DEMO —`, departments are fictional, and source URLs point at
`example.gov.in`, which is not a real site.

None of them is `verified`, and the seed **cannot** write that status — `app/seed.py` raises if
a record claims it, and the database's `schemes_verified_requires_date` constraint is a second
line of defence. Verification means a named person read the responsible department's official
page on a recorded date; no script can do that, so a seed that wrote `verified` would be
forging a provenance claim.

Because public responses serve verified records only, **the seeded records are invisible to the
public API**. To see them while developing:

```bash
echo 'ALLOW_UNVERIFIED_SCHEMES=true' >> backend/.env   # restart uvicorn afterwards
```

Keep that flag off anywhere a citizen can reach. Real schemes enter the catalogue through
[`docs/research-register.md`](docs/research-register.md), never through the seed.

## Eligibility checks

The evaluator is deterministic Python over a small typed rule format — no `eval`, no language
model. Three outcomes: `eligible`, `ineligible`, and `needs_more_information` when a required
fact is missing or the rules cannot be read. **A missing answer is never treated as a pass.**

Answers are not stored: they are used to compute the response and discarded. Format and
semantics: [`docs/eligibility-rules.md`](docs/eligibility-rules.md).

## Tests

```bash
cd backend && source .venv/bin/activate
pytest                    # 121 tests
pytest tests/unit         # no database needed
pytest tests/integration  # needs the test database
```

```bash
./scripts/db.sh test-db   # create sahayak_test and apply migrations to it
```

Integration tests use **`sahayak_test`**, never your development database, and each runs in a
transaction that is rolled back. Without a test database they skip with a message naming the
command to run, so unit tests still work anywhere.

```bash
cd frontend && npm run typecheck && npm run build
```

## Documentation

| File | What it answers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | The stack, folder responsibilities, request path, error handling, security boundaries |
| [`docs/api-contracts.md`](docs/api-contracts.md) | The health endpoint in full; Phase 1 endpoints marked planned |
| [`docs/database-schema.md`](docs/database-schema.md) | Planned tables, Supabase Free limits, **the RLS-bypass risk**, migrations, export/restore |
| [`docs/phase-plan.md`](docs/phase-plan.md) | What is active and what is gated |
| [`docs/research-register.md`](docs/research-register.md) | How a scheme gets verified before it is shown |
| [`docs/privacy.md`](docs/privacy.md) | Synthetic data, minimisation, consent, secrets, deletion |
| [`docs/eligibility-rules.md`](docs/eligibility-rules.md) | The rule format, the three outcomes, and what it cannot express |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | Product requirements: problem, users, stories |
| [`DECISIONS.md`](DECISIONS.md) | Technology choices and what was rejected |
| [`AGENTS.md`](AGENTS.md) | Working rules for everyone, human and AI |
| [`prototype/README.md`](prototype/README.md) | The superseded Next.js-only prototype and what to harvest from it |

---

## Repository layout

```
sahayak/
├── docs/              shared contracts and decisions, reviewed by all three
├── frontend/          Next.js App Router + TypeScript (Person A)
├── backend/           FastAPI — all domain logic, AI, database (Person C; services by B)
├── supabase/          migrations/ — the single canonical migration history
├── prototype/         superseded Next.js-only prototype, excluded from the build
└── .github/workflows/ CI: backend tests, frontend typecheck and build
```

## Who owns what

| Person | Owns | Must not |
|---|---|---|
| **A — Frontend** | `frontend/`: Next.js, TypeScript, layout, typed API client, UI states | Implement Python business logic |
| **B — Python AI and domain** | Phase 0: scheme research template, rules-format outline, synthetic scenarios. Later: eligibility, OCR, translation, AI services | Build the engine before Phase 2 opens |
| **C — Python backend and platform** | `backend/`, database planning, migrations, env config, security docs, tests, CI | Put domain logic in routes |

Shared contracts live in `docs/` and are reviewed by all three.

---

## Phase 1 exit checklist

| # | Item | State |
|---|---|---|
| 1 | Local PostgreSQL configured by environment variable | ✅ `./scripts/setup-local-db.sh` |
| 2 | Migration creates `schemes`; the app never auto-creates it | ✅ no `create_all` anywhere |
| 3 | The API reads real rows from PostgreSQL | ✅ verified in a browser |
| 4 | Public endpoints expose verified schemes only | ✅ 6 tests, list + detail + eligibility |
| 5 | Eligibility is deterministic, explainable, stateless | ✅ 40 unit + 20 integration tests |
| 6 | The Next.js UI uses the real API | ✅ no mock path exists in the client |
| 7 | Seed data is visibly synthetic and never falsely verified | ✅ guard raises; constraint backs it |
| 8 | Backend tests pass; frontend typecheck and build pass | ✅ 121 passed · typecheck · build |
| 9 | Phase 0 health behaviour intact | ✅ its tests still pass unchanged |
| 10 | Docs give exact run/migration/test steps and state what is missing | ✅ this file + `docs/` |

### What is NOT implemented

- **No real scheme data.** The catalogue holds four synthetic records. Verifying real schemes
  against official sources is Phase 2.
- No authentication, no accounts, no saved profiles.
- No document upload, OCR, PDF generation, voice, translation, complaints, maps or dashboards.
- No cloud deployment. Development runs on local PostgreSQL.
- The rule format cannot express `or`, nested conditions, fact-to-fact comparisons, dates or
  durations — see the limitations section of `docs/eligibility-rules.md`.

### Moving to hosted PostgreSQL later

The application is portable: it talks to PostgreSQL through SQLAlchemy and psycopg, with no
Supabase SDK and no cloud-only dependency. To deploy:

1. Create the hosted database (Supabase or any managed PostgreSQL).
2. Apply the **same reviewed migrations** from `supabase/migrations/`.
3. Set `DATABASE_URL` in the deployment environment — never in a committed file. Prefer the
   session pooler on Supabase Free; the direct connection is IPv6-only there.
4. Keep `ALLOW_UNVERIFIED_SCHEMES` unset.
5. Configure secrets, backups and TLS, and verify network and access policies before any real
   data exists.

Nothing in this phase deploys or modifies a cloud project.
