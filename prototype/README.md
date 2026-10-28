# prototype/ — superseded, kept for reference

This is the earlier **Next.js-only** prototype, written before the architecture moved to
`Next.js → FastAPI → Supabase`. It is kept because parts of it are useful input for later
phases, and deleting work that took hours to write would be wasteful.

**It is not part of the Phase 0 application.** It is excluded from the build, it is not
deployed, and nothing in `frontend/` or `backend/` imports from it.

## Why it was superseded

It put business logic in Next.js route handlers — document extraction, eligibility matching,
letter drafting, classification. The current architecture requires that logic to live in Python
(see `../docs/architecture.md`). It also depended on a demo-data fallback layer that returned
plausible-looking results when an API failed, which the current rules forbid for anything
user-facing.

It was also never completed: `data/schemes.json` is missing (so `lib/eligibility.ts` cannot
import), seven API route handlers were never written, and `npm run build` was never run here.

## What is worth harvesting, and where it goes

| Prototype file | Reusable as | Phase |
|---|---|---|
| `lib/eligibility.ts` | Reference for the Python eligibility engine's shape — the near-miss and "one document away" idea is worth keeping | 2 |
| `lib/types.ts` | Reference when designing Pydantic schemas | 1–2 |
| `lib/demo.ts` | A starting point for **synthetic** test scenarios. Note: it was written as a UI fallback, which is no longer allowed. | 2 |
| `app/api/*/route.ts` prompts | Prompt drafts for the Python AI services | 3+ |
| `components/voice/*` | Web Speech and camera handling — browser capabilities legitimately stay in TypeScript | 5 |
| `lib/offline.ts`, `lib/db.ts` | Offline queue approach, if offline sync is ever scheduled | unscheduled |

Harvest by **reading and rewriting**, not by copying files across. Anything moved into
`frontend/` must drop its mock-success fallbacks first.

## Do not

- Do not add it to a workspace, build it, or deploy it.
- Do not import from it in `frontend/` or `backend/`.
- Do not revive its Next.js API routes — that logic belongs in FastAPI.
