# Sahayak

A multilingual citizen-assistance platform for discovering government schemes, checking
eligibility, understanding official documents and preparing forms.

**Current phase: Phase 0 — foundation.** No citizen-facing feature is implemented. What works
today is the Next.js → FastAPI path and an honest health report. Later phases are gated in
[`docs/phase-plan.md`](docs/phase-plan.md).

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

### 2. Frontend — Next.js

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The status panel calls the real FastAPI endpoint — there is no mock.

### Verify

```bash
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

```bash
cd backend && source .venv/bin/activate && pytest     # 15 tests
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

## Documentation

| File | What it answers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | The stack, folder responsibilities, request path, error handling, security boundaries |
| [`docs/api-contracts.md`](docs/api-contracts.md) | The health endpoint in full; Phase 1 endpoints marked planned |
| [`docs/database-schema.md`](docs/database-schema.md) | Planned tables, Supabase Free limits, **the RLS-bypass risk**, migrations, export/restore |
| [`docs/phase-plan.md`](docs/phase-plan.md) | What is active and what is gated |
| [`docs/research-register.md`](docs/research-register.md) | How a scheme gets verified before it is shown |
| [`docs/privacy.md`](docs/privacy.md) | Synthetic data, minimisation, consent, secrets, deletion |
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

## Phase 0 definition of done

| # | Item | State |
|---|---|---|
| 1 | Next.js starts and displays the live health result from FastAPI | ✅ verified in a browser |
| 2 | FastAPI starts without Supabase credentials | ✅ asserted by a test |
| 3 | Health reports the real database configuration and connection status | ✅ all 3 states observed live |
| 4 | Backend tests pass | ✅ 15 passed |
| 5 | Frontend type-check and production build pass | ✅ both |
| 6 | `.env.example` and `.gitignore` correct | ✅ |
| 7 | Architecture, API, schema, phase and privacy docs exist | ✅ 6 files in `docs/` |
| 8 | Supabase Free limits and data-access risks documented | ✅ verified against official docs |
| 9 | Repository layout and migration source of truth clear | ✅ `supabase/migrations/` only |
| 10 | No future feature silently started | ✅ a test asserts Phase 1 paths 404 |

**Known gap:** no Supabase project exists yet, so nothing has been verified against cloud
infrastructure — in particular the session-pooler connection string and the Free-tier behaviour.
Development is unblocked regardless, because it runs on local PostgreSQL. Creating the cloud
project belongs with the first deployment, not with Phase 1 development.
