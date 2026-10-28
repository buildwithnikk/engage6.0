# DECISIONS — Sahayak

Technology choices and what was rejected.

> **Four of these decisions have been reversed.** The project moved from a Next.js-only app to
> `Next.js → FastAPI → Supabase`, with all domain logic in Python. The reversals are recorded in
> §"Reversed decisions" immediately below; the original entries are kept underneath, unedited,
> because the reasoning behind a reversal is only legible next to what it replaced.
>
> Entries D1–D11 below describe the **superseded** prototype, now parked in `prototype/`.
> Read them as history, not as current guidance.

---

## Reversed decisions

### R1 — Next.js API routes → Python FastAPI *(reverses D1)*

**Now:** a separate FastAPI service owns all domain logic, AI, OCR and database access. Next.js
holds the UI and browser capabilities only.

**Why the reversal:** D1 optimised for a 4-hour single deploy, and it was right for that. It was
wrong for a project that has to keep going. Eligibility determination has to be deterministic,
auditable, versioned and unit-testable, and AI/OCR/database work all belong in one language with
one test suite. Splitting business logic between a TypeScript route handler and a future Python
service would have produced two half-correct implementations of the same rule.

**Cost accepted:** two processes, two installs, CORS configuration, and the prototype's nine
route handlers now need rewriting in Python.

### R2 — Strict builds in `frontend/` *(reverses D8 for the new app)*

**Now:** `frontend/next.config.js` sets no `ignoreBuildErrors`. Type and lint errors fail the
build, and CI runs `typecheck` plus `build`.

**Why:** D8 traded correctness for a guaranteed deploy at minute 235 of a hackathon. There is no
such deadline on a foundation, and silently shipping a type error into the layer everything else
is built on is the expensive kind of mistake. The forgiving setting survives only in
`prototype/next.config.js`.

### R3 — Automated tests exist *(reverses D9)*

**Now:** 15 backend tests (`pytest` + FastAPI `TestClient`), run in CI.

**Why:** D9 argued that hand-testing a demo beat spending 40 minutes on test setup. That held for
a demo. It does not hold for a health contract that other work depends on, and the tests paid for
themselves immediately — they are what proves the app starts with no credentials, that a dead
database reports `unavailable` rather than `ok`, that credentials never appear in a response, and
that no Phase 1 endpoint has been quietly added.

### R4 — No mock-success fallbacks in user-facing surfaces *(reverses D10)*

**Now:** `lib/api-client.ts` has no fallback path. A failure is classified and surfaced; the UI
says the backend is unreachable and that the database state is therefore unknown.

**Why:** D10's fallback layer solved real problems (nobody blocked, demo survives bad wifi) and
created a worse one: a UI that cannot be trusted. A health indicator that shows green when the
backend is down is not a degraded feature, it is a false statement. Synthetic data keeps its
legitimate home — fixtures and tests, per `docs/privacy.md` — not the UI.

**Still true from D10:** fallbacks must never be invisible. The mechanism is gone; the principle
that the product never claims a result it did not get is now in `AGENTS.md`.

---

## Decisions that carried over unchanged

- **D3 — eligibility is deterministic, never a model.** Reaffirmed and strengthened: it is now a
  Python engine with a `rules_version` on every response, and three-valued output so a missing
  answer cannot be silently treated as a pass.
- **D5 — the OpenStreetMap stack** remains the choice if and when maps are scheduled: keyless
  and free, where Google and Mapbox require billing.
- **D7 — minimal persistence.** Now stronger: eligibility in the first MVP is stateless, and no
  profile table is created before the phase that needs it.
- **D11 — Supabase optional at start-up.** Now a tested property rather than a convention: the
  app must import and serve with no `DATABASE_URL`, and a test asserts it.

---

## New decisions

### N1 — `supabase/migrations/` is the only migration history

Alembic is deliberately not introduced. SQLAlchemy models map a schema that migrations created;
they never generate a competing history. Two migration tools on one database is how a schema
stops being reproducible.

### N2 — Nothing applies schema automatically

No CI step and no application start-up runs a migration. Applying schema to a remote project is
a deliberate human act after review. An auto-migrating deploy is how a reviewed `drop column`
reaches production unseen.

### N3 — The health endpoint returns 200 even when the database is down

"The API is up" and "the database is reachable" are different facts, and the response carries
both. A 503 would make the API itself look down and would hide the distinction the frontend needs
in order to tell the user the truth. A readiness probe for an orchestrator, if ever needed, gets
its own path.

### N4 — Only the exception class name crosses a boundary

Database driver messages routinely contain the host, the user and sometimes the password, so the
message is never logged or returned — only `type(exc).__name__`. Two tests assert that a
password, a username and a host do not appear in a health response.

### N5 — Python 3.12 target, 3.13 locally

`requires-python = ">=3.12"` and CI pins 3.12. The machine this was scaffolded on has 3.13.5 and
no 3.12; the suite passes on it. Recorded rather than hidden, because "works on my machine" is
exactly the thing a pinned CI version is for.

---

## Superseded entries (prototype, Next.js-only)

The original text follows, unedited.

---

## D1 — Next.js App Router, frontend and API in one deployment

**Chosen:** Next.js 14 + TypeScript + Tailwind, deployed to Vercel.

**Why it fits:** one `npm install`, one build, one deploy, one URL. API routes give us a
server-side place to hold the Gemini key without standing up a second service. The team already
knows React.

**Rejected**
- *FastAPI backend + separate React frontend* — our earlier plan. It doubles deploys, needs CORS,
  and splits env vars across two hosts. The only thing it buys is Python's AI libraries, and we
  do not use them: Gemini is an HTTP call.
- *Vite SPA* — then the Gemini key has to live in the browser, which is disqualifying.
- *Express + static build* — more to configure, nothing gained.

**Trade-off:** we give up Python's OCR and ML ecosystem. Accepted, because Gemini's vision call
replaces the OCR pipeline entirely, and nothing here needs model training.

---

## D2 — Gemini 2.0 Flash as the single model, Groq as fallback

**Chosen:** Gemini 2.0 Flash for every AI route; Groq (Llama 3.3 70B) as an automatic fallback
for text-only calls.

**Why it fits:** free tier with no card, vision and JSON mode in one model, and strong Indian-
language output. One key unlocks nine routes — extraction, classification, translation,
simplification, letter drafting, rejection decoding, trip planning, message verification. Adding
a second provider for any of those would cost setup time and buy nothing.

**Why two providers at all:** the free tier is rate-limited per minute. Three developers testing
at once can exhaust it, and so can a demo. Groq covers the text routes; vision routes fall
straight through to canned data.

**Rejected**
- *Anthropic / OpenAI paid APIs* — the brief forbids paid APIs.
- *Self-hosted Llama / Ollama* — no time, and the demo laptop has other work to do.
- *Separate OCR service (PaddleOCR, Google Vision)* — a second integration for something the
  vision model already does. Tesseract.js stays, but only for the offline path.

**Trade-off:** we depend on one vendor's free tier. Mitigated by the three-level fallback in
`lib/gemini.ts`, which is also why the app demos with no key at all.

---

## D3 — json-logic for eligibility, never the model

**Chosen:** eligibility is `json-logic` rules in `data/schemes.json`, evaluated in
`lib/eligibility.ts`. The model's only role is drafting those rules offline, and a human checks
every one.

**Why it fits:** deterministic, instant, works offline, and costs no quota. More importantly it
is *correct*: telling a citizen they qualify when they do not is the most harmful bug this app
could ship, and the first thing a judge will probe.

**Rejected**
- *Ask the model "is this person eligible?"* — hallucinates, is unreproducible on stage, and
  needs a network call per scheme.
- *A real rules engine (Drools, durable-rules)* — far more than 25 schemes need.
- *SQL predicates in Supabase* — couples eligibility to a database we have made optional.

**Trade-off:** hand-written rules cover fewer schemes and will be imperfect. Accepted, and the
UI must say the result is indicative rather than an official determination.

---

## D4 — Browser-native speech instead of a speech API

**Chosen:** Web Speech API for recognition, `SpeechSynthesis` for playback.

**Why it fits:** zero setup, zero cost, no key, no rate limit, and it supports `hi-IN`, `ta-IN`,
`bn-IN` and more. Voice is the feature that makes the app usable for a non-reader, and it was
available within minutes of starting.

**Rejected**
- *Bhashini (AI4Bharat)* — the right long-term answer and government-built, but registration is
  approval-gated; we cannot bet a 4-hour demo on an approval queue. It belongs on the roadmap.
- *Whisper via API* — paid at the scale we would need, and no streaming on a free tier.
- *whisper.cpp in-browser* — a large model download on a village phone.

**Trade-off:** recognition is effectively Chrome-only, and dialects are not covered.
Mitigated by a visible typing fallback (REQUIREMENTS AC5.5) and by demoing in Chrome.

---

## D5 — OpenStreetMap stack (MapLibre, Nominatim, OSRM)

**Chosen:** MapLibre GL for the map, Nominatim for reverse geocoding, OSRM's public demo server
for routing.

**Why it fits:** all three are keyless and free. Google Maps and Mapbox both require a billing
account, which the brief rules out.

**Rejected**
- *Google Maps Platform / Mapbox* — card required.
- *Mappls (MapmyIndia)* — better Indian data, but registration and key approval.
- *Ward boundary GeoJSON + PostGIS point-in-polygon* — the technically correct way to find a
  ward. It needs real boundary files we do not have for this district; Nominatim's
  `city_district`/`suburb` is a good-enough proxy for a prototype, and we say so.

**Trade-off:** Nominatim's 1 req/sec limit and OSRM's no-guarantee demo server will fail at some
point. Both have cached fallbacks (`lib/geo.ts`, `lib/osrm.ts`), and the UI reports which source
answered.

---

## D6 — IndexedDB (Dexie) + a hand-written service worker

**Chosen:** Dexie for the profile, the write queue and the response cache; a small `public/sw.js`
for the cached shell.

**Why it fits:** offline is a headline feature, not a nicety — the airplane-mode demo is the
moment the project stops looking like a CRUD app. Dexie is a thin wrapper and the queue is ~60
lines in `lib/offline.ts`.

**Rejected**
- *next-pwa / Workbox* — it was in the original plan and we dropped it. It adds a build-time
  plugin with its own Next 14 quirks, for a cache strategy we can write by hand in 30 lines.
- *PowerSync / RxDB / ElectricSQL* — real sync engines, each a bigger integration than the rest
  of the app combined.
- *CRDTs (Yjs / Automerge)* — solves concurrent multi-editor conflicts. We have one writer per
  device and no collaborative editing, so there is no conflict to resolve.
- *localStorage* — too small for queued images, and synchronous.

**Trade-off:** no cross-device sync, and our conflict policy is last-write-wins. Correct for the
actual requirement (one citizen, one device).

---

## D7 — No authentication, data on the device

**Chosen:** no accounts, no phone OTP. The profile lives in IndexedDB; "delete my data" clears it.

**Why it fits:** auth costs setup time and buys nothing a demo needs. It is also the stronger
privacy story: documents are extracted and the result stays on the phone, so there is no
server-side pile of citizen documents to defend. Supabase stores complaints and ratings, which
are civic and can be anonymous.

**Rejected**
- *Supabase phone OTP* — needs an SMS provider, which is paid.
- *Email/password* — many target users have no email.
- *Anonymous Supabase sessions* — unnecessary once the profile is local.

**Trade-off:** clearing the browser loses the profile, and a shared phone shows the previous
user's data until it is cleared — which is exactly why "delete my data" is a visible feature.
Noted honestly rather than papered over.

---

## D8 — `ignoreBuildErrors` in `next.config.js`

**Chosen:** TypeScript and ESLint errors do not block the production build.

**Why it fits:** the single most common way a hackathon team loses its demo is a type error
blocking the final deploy at minute 235. Types still guide the editor; `npm run typecheck`
reports them when we want them.

**Rejected:** strict build gating — correct for production software, wrong when the deploy
deadline is absolute.

**Trade-off:** a real type error can reach production. Accepted deliberately, limited to this
prototype, and flagged here so nobody mistakes it for a default worth keeping.

---

## D9 — Manual test plan, no automated tests

**Chosen:** [TEST_PLAN.md](TEST_PLAN.md), executed by hand on a real phone.

**Why it fits:** of 240 minutes, a usable Jest/Playwright setup costs 30–40, and would cover the
code least likely to break. What actually breaks is camera permissions, speech on a real device,
service-worker caching and third-party failure — all of which are faster and more honestly
verified by hand.

**Rejected:** Vitest unit tests, Playwright E2E. Both are the right call for a project that
lives past this week. `lib/eligibility.ts` is the one place with real logic worth unit-testing,
and it is the first thing to test if this project continues.

**Trade-off:** no regression safety net. Mitigated by the fixed checkpoints in TASKS.md and by
running the primary journey twice before submission.

---

## D10 — `lib/demo.ts` as a first-class fallback layer

**Chosen:** every route passes a realistic fallback into `callModel`; every third-party helper
returns cached data on failure. The app runs fully with no keys and no network.

**Why it fits:** it solves three problems with one mechanism — (1) three people are never blocked
by an unfinished route, because a stub returns the right shape immediately; (2) a dead venue
network cannot kill the demo; (3) the fallback path is exercised constantly during development
instead of being written in a panic at the end.

**Rejected:** "we'll add error handling later" — which, under a deadline, means never, and
guarantees the stack trace appears on stage.

**Trade-off:** the UI can present fallback data as if it were live. Mitigated by `_source` on
every model response, so a developer can always tell — and so we never claim a live result we
did not get.

---

## D11 — Supabase optional, not required

**Chosen:** `lib/supabase.ts` exports `null` when env vars are absent, and every data route
branches on `hasSupabase`.

**Why it fits:** it removes Supabase from the critical path. If the project setup drags or the
free-tier project misbehaves, the whole demo still runs on `lib/demo.ts`. Persistence becomes an
upgrade rather than a dependency.

**Rejected:** requiring the database — one sign-up problem would block three people.

**Trade-off:** complaints filed in the no-Supabase mode do not persist across a redeploy. Fine
for a demo, and TASKS.md ranks the schema as P2 for exactly this reason.

---

## Open questions

| Question | Decide by | Owner |
|---|---|---|
| Do we wire Supabase at all, or demo entirely from `lib/demo.ts`? | 2:15 checkpoint | C |
| How many schemes do we actually hand-verify — 25, or more? | 1:00 | B |
| Which district's demo data: keep Sitapur, or switch to the venue's city? | 0:25 | all |
| Do we show the dashboard in the 3-minute demo, or cut it for time? | 3:25 | presenter |
