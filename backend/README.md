# Sahayak backend

FastAPI service. Owns **all** domain logic, AI processing, OCR and database access for the
platform. The Next.js frontend contains no business logic.

Phase 1 endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | Liveness plus the real database state |
| `GET /api/v1/schemes` | Catalogue list — **verified records only** |
| `GET /api/v1/schemes/{scheme_id}` | One scheme, by UUID or slug |
| `POST /api/v1/eligibility/check` | Deterministic, stateless eligibility check |

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

## Database

Migrations live in `../supabase/migrations/` and are applied deliberately, never by the app.

```bash
../scripts/db.sh migrate     # apply (idempotent)
../scripts/db.sh rollback    # drop the catalogue (confirms first)
../scripts/db.sh seed        # synthetic demo records (idempotent)
../scripts/db.sh test-db     # create sahayak_test and apply migrations to it
```

Nothing in `app/` issues DDL. `Base.metadata.create_all()` is deliberately never called: two
sources of schema truth is how a schema stops being reproducible.

## Test

```bash
cd backend
source .venv/bin/activate
pytest                      # whole suite — 121 tests
pytest tests/unit           # no database needed
pytest tests/integration    # needs sahayak_test
pytest -v                   # per-test names
```

Unit tests need no database. Integration tests use **`sahayak_test`** — resolved from
`TEST_DATABASE_URL`, or derived from `DATABASE_URL` by swapping the database name — and each
runs inside a transaction that is rolled back. A test run can never damage the development
catalogue. Without a test database they skip with a message naming the fix.

`tests/conftest.py` disables pydantic's `.env` loading for the whole suite, so results do not
depend on whether the developer happens to have a local database configured.

## Lint and format

```bash
ruff check .          # lint
ruff check . --fix    # autofix
ruff format .         # format
```

## Layout

```
app/
├── main.py                       app factory, CORS, router registration
├── seed.py                       idempotent synthetic seed
├── core/config.py                typed settings from the environment
├── api/
│   ├── deps.py                   request-scoped DB session
│   └── v1/
│       ├── router.py             aggregates v1 routes
│       ├── health.py             GET /health
│       ├── schemes.py            GET /schemes, GET /schemes/{id}
│       └── eligibility.py        POST /eligibility/check
├── schemas/                      Pydantic request/response models
├── models/scheme.py              SQLAlchemy model of the schemes table
├── repositories/                 all SQL lives here
├── services/
│   ├── scheme_service.py         visibility policy, presentation shaping
│   └── eligibility/
│       ├── rules.py              typed rule format
│       └── engine.py             pure deterministic evaluator
└── db/
    ├── base.py                   declarative base (never issues DDL)
    └── session.py                lazy engine + health check
tests/
├── unit/                         rules, engine, config — no I/O
└── integration/                  endpoints against real PostgreSQL
```

Layering: routes → services → repositories → models. A route unwraps the request, calls a
function and returns a model; `health.py` is 15 lines and the Phase 1 routes are not much
longer.

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
6. **Public means verified.** `scheme_service.visible_statuses` is the single place that
   decides what a caller may see. Never bypass it in a route or a repository call.
7. **The evaluator stays pure.** `services/eligibility/` does no I/O and must never import a
   session, a model, or an AI client.
8. **Nothing persists eligibility answers.** No table, no log line, no cache.

## Database

Phase 0 writes no migration and applies no schema. See `../docs/database-schema.md` for the
planned tables, the Supabase Free-tier limits, the RLS-bypass risk, and the export/restore
commands. Migrations live in `../supabase/migrations/` and are applied deliberately by a human.
