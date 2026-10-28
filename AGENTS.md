# AGENTS.md — working rules for this repository

Applies to every AI assistant and every human working in this repo.

The architecture changed after the first version of this file was written. **The rules in
"Current rules" below are authoritative.** The original rules are kept further down, unedited,
and now apply only to `prototype/`.

---

# Current rules (Phase 0 onward)

## Context

`React + Next.js + TypeScript → Python FastAPI → Supabase PostgreSQL`.

**Python owns all domain logic, AI, OCR, database access and integrations. TypeScript owns the
UI and browser capabilities only.**

Active phase: **Phase 0**. Read [docs/architecture.md](docs/architecture.md) before writing
code, and [docs/phase-plan.md](docs/phase-plan.md) to see what is open. Later phases are gated.

Owners: **A** `frontend/` · **B** Python AI and domain services · **C** `backend/`, database,
platform.

## Commands

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
pytest
ruff check .
```

```bash
# Frontend
cd frontend
npm run dev
npm run typecheck
npm run build
```

## Rules that are not negotiable

1. **No business logic in a Next.js route handler.** If it needs a server, it goes in FastAPI.
2. **Routes stay thin.** A FastAPI route unwraps the request, calls a function, returns a
   Pydantic model. Domain logic lives in `backend/app/services/` (Phase 1+).
3. **Eligibility is deterministic Python, never a model.** Versioned, explainable,
   three-valued — a missing answer is `insufficient_information`, never a guessed pass or fail.
4. **Never report a state you did not verify.** `check_database` returns `ok` only after a real
   `SELECT 1`. The same principle governs every future status the product shows.
5. **No mock-success fallback in anything user-facing.** No fake AI output, no sample scheme
   list, no hardcoded eligibility result. If a dependency is down, say so. Synthetic data belongs
   in fixtures and tests, not in the UI.
6. **Secrets stay server-side.** Never put a credential in a `NEXT_PUBLIC_*` variable — that
   prefix inlines it into the browser bundle permanently.
7. **Never leak credentials in an error.** Driver messages contain host, user and sometimes the
   password. Log and return the exception *class name* only.
8. **No wildcard CORS origin with credentials.** `core/config.py` enforces it; do not work around it.
9. **`supabase/migrations/` is the only migration history.** No Alembic. SQLAlchemy models map
   what migrations created.
10. **Nothing applies schema automatically** — not CI, not app start-up. A human applies a
    reviewed migration.
11. **Do not start a gated phase.** No folder, table, endpoint or dependency for a phase that has
    not opened. A test asserts that Phase 1 paths return 404; if you make it fail, you have
    started Phase 1.
12. **`frontend/src/types/api.ts` and `backend/app/schemas/` change in the same commit.** The
    contract is shared and reviewed by all three.
13. **No new dependency** unless it removes more code than it adds. No new folder unless
    `docs/architecture.md` names it.
14. **`prototype/` is frozen.** Do not build it, deploy it, or import from it. Harvest ideas by
    rewriting, never by copying files.

## Honesty rules

- Never claim an integration we do not have — DigiLocker, Aadhaar, a department portal, a
  grievance system.
- Eligibility output is **indicative**, never an official determination. Say so wherever it appears.
- Never show a scheme that has not been verified against its responsible department's own source.
- Never claim RLS protects data reached through a connection that bypasses it — the backend's
  privileged connection does bypass it. See `docs/database-schema.md` §4.
- Never fabricate a field from an unreadable document. Low confidence is a valid answer.
- **Never say a check passed unless you ran it.** If it cannot run, name the precise blocker.
- No real citizen document, ever — not even your own. Synthetic data only. See
  [docs/privacy.md](docs/privacy.md).

## Before you say a task is done

Run the commands. Backend: `pytest`. Frontend: `npm run typecheck && npm run build`. For
anything user-facing, load it in a browser with the backend both running and stopped — the error
path is half the feature. Then check the Phase 0 checklist in the root [README.md](README.md).

---

# Superseded rules (apply to `prototype/` only)

The original text follows, unedited. It describes the Next.js-only prototype, whose files now
live in `prototype/`. Paths such as `lib/gemini.ts` and `ARCHITECTURE.md` refer to
`prototype/lib/gemini.ts` and `prototype/ARCHITECTURE.md`.

## Context

4-hour hackathon prototype. Next.js 14 App Router, TypeScript, Tailwind. Three owners:
**A** frontend/voice/offline · **B** AI/prompts/scheme logic · **C** data/maps/dashboard.

## Commands

```bash
npm install          # first run
npm run dev          # http://localhost:3000
npm run build        # must pass before any deploy
npm run typecheck    # informational: the build ignores type errors on purpose (DECISIONS D8)
```

## Rules that are not negotiable

1. **Only `lib/gemini.ts` calls a model.** Everything goes through `callModel`, which already
   handles the timeout, the Groq fallback and the demo fallback.
2. **Eligibility is `json-logic` only.** Never ask a model whether someone qualifies
   (DECISIONS D3). Same for the complaint's department: it is the `departmentFor()` lookup.
3. **Every API route always returns the shape in `lib/types.ts`**, passing a `lib/demo.ts`
   fallback. A degraded 200 beats a 500. Never let a route throw.
4. **Every write goes through `postOrQueue`** in `lib/offline.ts`. That one chokepoint is what
   makes the app work offline.
5. **`components/` belongs to Person A.** Need different behaviour? Add a prop, do not fork the
   component.
6. **Do not change `lib/types.ts` or a route's response shape** without all three people
   agreeing. Those contracts are frozen (ARCHITECTURE §7.2).
7. **Secrets stay server-side.** Never add `NEXT_PUBLIC_` to an API key.
8. **Wrap every IndexedDB access.** It can be empty or throw in a private window.
9. **No new dependency** unless it removes more code than it adds. No new folder unless
   ARCHITECTURE.md names it.
10. **No paid or approval-gated API.** The constraint is in REQUIREMENTS §7 and the rejected list
    is in §6 — do not reintroduce DigiLocker, Bhashini, WhatsApp, Twilio or Aadhaar auth.

## Honesty rules

- Never claim an integration we do not have. No screen may imply DigiLocker, Aadhaar, CPGRAMS or
  Bhashini is connected.
- Eligibility output is **indicative**, never an official determination. Say so in the UI.
- Never fabricate a citizen's data from an unreadable document. Low confidence is an answer.
- Demo data only. No real person's documents in the repo, the prompts or the demo.
- When you report progress, say what is actually verified and what is not.

## Style

- Match the surrounding code. Comments explain *why*, and each `lib/` file already names its owner.
- Hindi is the default UI language; user-facing strings go through `useLang()`.
- Keep pages presentational and routes thin. Logic lives in `lib/`.

## Before you say a task is done

Check the task's acceptance criteria in TASKS.md, then the relevant section of
[TEST_PLAN.md](TEST_PLAN.md). "It compiles" is not done. For anything user-facing, confirm it on
a real phone against the deployed URL — localhost lies about service workers, speech and the camera.
