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

## Configuring `DATABASE_URL` safely

`DATABASE_URL` is a **secret**. It belongs in `backend/.env` only — never in `frontend/`, never
in a `NEXT_PUBLIC_*` variable, never committed. `.gitignore` excludes `.env` files.

1. Create a project at [supabase.com](https://supabase.com) (Free tier).
2. Dashboard → **Connect**. Copy the exact string; the pooler host cannot be guessed.
3. Pick a mode: **direct** (port 5432) for a persistent server on an IPv6-capable network, or
   the **session pooler** (port 5432, user `postgres.[PROJECT-REF]`) on an IPv4-only network —
   Free tier has no IPv4 add-on, so a direct string will simply fail there.
4. Add the driver prefix SQLAlchemy needs and percent-encode `&`, `#`, `?` or spaces in the
   password:

```
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres
```

5. Restart uvicorn and reload the page. The status panel should show **Connected**. If it shows
   **Unavailable**, the string or the network path is wrong — the detail message says which
   exception class occurred, without echoing your credentials.

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
| 3 | Health reports the real database configuration and connection status | ✅ 3 states, asserted |
| 4 | Backend tests pass | ✅ 15 passed |
| 5 | Frontend type-check and production build pass | ✅ both |
| 6 | `.env.example` and `.gitignore` correct | ✅ |
| 7 | Architecture, API, schema, phase and privacy docs exist | ✅ 6 files in `docs/` |
| 8 | Supabase Free limits and data-access risks documented | ✅ verified against official docs |
| 9 | Repository layout and migration source of truth clear | ✅ `supabase/migrations/` only |
| 10 | No future feature silently started | ✅ a test asserts Phase 1 paths 404 |

**Known gap:** no Supabase project is connected, so `database: "ok"` has never been observed on
real infrastructure — only `unconfigured` and `unavailable` are proven. Connecting a project is
the first step of Phase 1.
