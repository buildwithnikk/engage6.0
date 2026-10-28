# AGENTS.md — working rules for this repository

New file: no `AGENTS.md` or `CLAUDE.md` existed before this documentation pass, so nothing was
overwritten. If you add project conventions here later, append — do not replace.

Applies to every AI assistant and every human working in this repo.
Read [ARCHITECTURE.md](ARCHITECTURE.md) before writing code, and [TASKS.md](TASKS.md) to find
what to do next.

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
