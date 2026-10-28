# CLAUDE.md

This project keeps its working rules in **[AGENTS.md](AGENTS.md)** — read that file first. Its
"Current rules" section is authoritative; the section below it applies only to `prototype/`.

Appended, not replaced, as the architecture changed. If you add project-specific instructions,
append them below rather than editing what is already here.

## One-line orientation

`React + Next.js + TypeScript → Python FastAPI → Supabase PostgreSQL`.
Python owns all domain logic, AI, OCR and database access. TypeScript owns UI and browser
capabilities only. Active phase: **Phase 0**; later phases are gated.

## Document map

**Current**
- [README.md](README.md) — run commands, `DATABASE_URL` setup, Phase 0 checklist
- [docs/architecture.md](docs/architecture.md) — structure, request path, error handling, security
- [docs/api-contracts.md](docs/api-contracts.md) — the health endpoint; Phase 1 marked planned
- [docs/database-schema.md](docs/database-schema.md) — planned tables, Supabase Free limits, RLS-bypass risk
- [docs/phase-plan.md](docs/phase-plan.md) — what is active, what is gated
- [docs/research-register.md](docs/research-register.md) — how a scheme is verified before it ships
- [docs/privacy.md](docs/privacy.md) — synthetic data, minimisation, consent, secrets, deletion
- [REQUIREMENTS.md](REQUIREMENTS.md) — product requirements and the feature backlog
- [DECISIONS.md](DECISIONS.md) — current choices, four reversals, and the superseded entries

**Superseded** (kept for reference, excluded from the build)
- [prototype/README.md](prototype/README.md) — what the prototype was and what to harvest
- `prototype/ARCHITECTURE.md`, `prototype/TASKS.md`, `prototype/TEST_PLAN.md`

## The three mistakes to avoid here

1. Putting domain logic in a Next.js route handler. It goes in FastAPI.
2. Returning mock data when a dependency fails. Report the real state instead.
3. Starting a gated phase. Check `docs/phase-plan.md` first.
