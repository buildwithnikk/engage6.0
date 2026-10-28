# Sahayak backend

FastAPI service. Owns **all** domain logic, AI processing, OCR and database access for the
platform. The Next.js frontend contains no business logic.

Phase 0 exposes exactly one endpoint: `GET /api/v1/health`.

## Python version

Target **3.12.x**, declared as `requires-python = ">=3.12"`. CI pins 3.12.

The machine this was scaffolded on has **3.13.5** and no 3.12, so local development here runs
on 3.13.5 and the test suite passes on it. If you hit a 3.13 incompatibility in a dependency,
install 3.12 (`brew install python@3.12`) and recreate the venv.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

```bash
cp .env.example .env    # DATABASE_URL may stay blank in Phase 0
```

## Run

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000/api/v1/health
- Interactive docs: http://localhost:8000/docs

The app starts with no database credentials. With `DATABASE_URL` blank, the health endpoint
reports `database: "unconfigured"` — that is correct, not a failure.

## Test

```bash
cd backend
source .venv/bin/activate
pytest                      # whole suite
pytest tests/unit           # no I/O
pytest tests/integration    # through the ASGI app
pytest -v                   # per-test names
```

Tests deliberately run with **no** `DATABASE_URL`: the suite asserts that the app imports,
serves, and reports `unconfigured` without credentials.

## Lint and format

```bash
ruff check .          # lint
ruff check . --fix    # autofix
ruff format .         # format
```

## Layout

```
app/
├── main.py              app factory, CORS, router registration
├── core/config.py       typed settings from the environment
├── api/v1/
│   ├── router.py        aggregates v1 routes
│   └── health.py        GET /health
├── schemas/health.py    Pydantic response model
└── db/session.py        optional, lazy database check — never connects at import
tests/
├── unit/                config and db-status behaviour, no I/O
└── integration/         the endpoint through FastAPI's TestClient
```

`app/services/` does not exist yet. Domain services arrive in Phase 1, when there is one to write.

## Conventions

1. **Routes stay thin.** Unwrap the request, call a function, return a Pydantic model.
   Domain logic belongs in `app/services/`.
2. **Never report a database state you did not verify.** `check_database` returns
   `ok` only after a successful `SELECT 1`.
3. **Never leak credentials.** Driver exception messages contain host, user and sometimes the
   password, so only the exception *class name* is logged or returned.
4. **The app must start without Supabase.** No module may connect at import time.
5. **No wildcard CORS origin with credentials.** `config.py` forces credentials off if a
   wildcard is configured.

## Database

Phase 0 writes no migration and applies no schema. See `../docs/database-schema.md` for the
planned tables, the Supabase Free-tier limits, the RLS-bypass risk, and the export/restore
commands. Migrations live in `../supabase/migrations/` and are applied deliberately by a human.
