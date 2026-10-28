# TASKS — Sahayak

Ordered implementation tasks against the **current** repository state
(see [REQUIREMENTS.md](REQUIREMENTS.md) §7 for what exists and what is missing).

**Budget:** 240 minutes · 3 people in parallel · 35 minutes reserved for testing and submission.
**Owners:** A = frontend/voice/offline · B = AI/prompts/scheme logic · C = data/maps/dashboard.
**Priority:** P0 = the demo fails without it · P1 = should-have · P2 = only if time remains.

> Estimates are wall-clock for one person with AI assistance. They assume the owner does not
> get blocked — the fallback rule in ARCHITECTURE.md §7.2 is what keeps that true.

---

## Phase 0 — Unblock the build (0:00–0:25) · everything depends on this

| # | Task | Owner | P | Est | Blocks |
|---|---|---|---|---|---|
| T1 | `npm install`, then `npm run build`. Fix whatever it reports. | A | P0 | 10m | everything |
| T2 | **Create `data/schemes.json`** — ≥25 schemes with hand-checked `json-logic` rules | B | P0 | 25m | T6, T7, T20, T22 |
| T3 | Create the 7 missing data route handlers as stubs returning `lib/demo.ts` shapes | C | P0 | 15m | T12–T16 |
| T4 | Get `GEMINI_API_KEY`, add to `.env.local`, verify one real call | B | P0 | 5m | all AI routes |
| T5 | Create Vercel project, deploy, confirm the URL loads on a phone | A | P0 | 10m | submission |

**T1 — files:** `package.json`, possibly `next-env.d.ts`
*AC:* `npm run build` exits 0.
*Verify:* `npm run build && npm start` then open `http://localhost:3000`.
⚠️ **This build will fail first time:** `lib/eligibility.ts` imports `@/data/schemes.json`, which
does not exist. Unblock immediately with a 3-scheme placeholder array, then let T2 replace it.

**T2 — files:** `data/schemes.json`
*AC:* ≥25 entries; each has every field in the `Scheme` type; `applyUrl` is a real `.gov.in`
page; ≥5 eligible and ≥2 near-miss for `DEMO_PROFILE`.
*Verify:* `curl -s localhost:3000/api/match -X POST -H 'content-type: application/json' -d '{}' | python3 -m json.tool`
*Method:* let the model draft rules from the public scheme pages, then **read every rule by hand**.
A wrong rule is worse than a missing scheme (REQUIREMENTS AC1.5).

**T3 — files:** `app/api/{complaint,complaints,route,pass,stats,rating}/route.ts`, `app/api/complaint/[id]/route.ts`
*AC:* each returns the `lib/types.ts` shape from `lib/demo.ts`; no page shows a fetch error.
*Verify:* `for r in complaints stats; do curl -s localhost:3000/api/$r | head -c 120; echo; done`

**T4 — files:** `.env.local` (git-ignored)
*AC:* `/api/extract` returns `_source: "gemini"` for a real photo.

**T5 — files:** none
*AC:* a public HTTPS URL renders the home screen on an actual phone.

---

## Phase 1 — Must-have features (0:25–2:15)

| # | Task | Owner | P | Est | Depends on |
|---|---|---|---|---|---|
| T6 | Wire schemes page to `/api/match`; verify unclaimed total and near-miss | A | P0 | 15m | T2 |
| T7 | Tune the `/api/extract` prompt on 3 real document photos | B | P0 | 25m | T4 |
| T8 | Scan screen: editable fields, persist to IndexedDB, mismatch warning | A | P0 | 20m | T7 |
| T9 | Voice form-fill end to end; confirm Hindi recognition on a phone | A | P0 | 20m | — |
| T10 | Client-side filled-PDF download | A | P0 | 10m | T9 |
| T11 | Tune `/api/explain-rejection` on 3 real portal messages | B | P0 | 15m | T4 |
| T12 | `/api/complaint` real implementation: Nominatim ward + department lookup | C | P0 | 20m | T3 |
| T13 | `/api/complaints` + `/api/complaint/[id]` with events | C | P0 | 15m | T3 |
| T14 | Complaint submit through `postOrQueue`; filed and queued states | C | P0 | 15m | T12 |
| T15 | Escalation threshold → Escalate / RTI buttons → printable letter | C | P0 | 20m | T13 |
| T16 | Tune `/api/draft` so escalation and RTI letters are properly formatted | B | P0 | 20m | T13 |
| T17 | `public/sw.js` + verify the app opens with the network off | A | P0 | 20m | T5 |
| T18 | Offline queue flush on reconnect; badge count reaches zero | A | P0 | 15m | T17 |
| T19 | Language switch across 3 languages; translation cached in IndexedDB | A/B | P0 | 15m | T4 |

**T6 — files:** `app/schemes/page.tsx` *AC:* AC1.2–AC1.4. *Verify:* open `/schemes`; the total matches the sum of the eligible list.
**T7 — files:** `app/api/extract/route.ts` *AC:* AC2.1, AC2.3. *Verify:* photograph a real Aadhaar-style card; ≥5 fields populate; then pull the network and confirm AC2.4.
**T8 — files:** `app/scan/page.tsx`, `lib/db.ts` *AC:* AC2.2, AC2.5. *Verify:* save, reload, open `/schemes` — the profile survives.
**T9 — files:** `app/form/page.tsx`, `components/voice/VoiceInput.tsx` *AC:* AC3.1–AC3.3. *Verify:* on a phone in Chrome, speak one Hindi answer per field.
**T10 — files:** `app/form/page.tsx` *AC:* AC3.4. *Verify:* open the downloaded PDF; every answer is present.
**T11 — files:** `app/api/explain-rejection/route.ts` *AC:* AC3.6. *Verify:* paste `PFMS: Account not seeded`, `e-KYC failed`, `Name mismatch with Aadhaar`.
**T12 — files:** `app/api/complaint/route.ts`, `lib/geo.ts` *AC:* AC4.2, AC4.3. *Verify:* submit, then block the Nominatim host and submit again — the named fallback ward appears, no error.
**T13 — files:** `app/api/complaints/route.ts`, `app/api/complaint/[id]/route.ts` *AC:* AC4.4.
**T14 — files:** `app/complaint/page.tsx` *AC:* AC4.1, AC4.6. *Verify:* file one online, one in airplane mode.
**T15 — files:** `app/complaint/[id]/page.tsx` *AC:* AC4.5. *Verify:* open the seeded old complaint; both buttons produce a letter naming an authority.
**T16 — files:** `app/api/draft/route.ts` *AC:* letters name an authority, cite the complaint id and the elapsed days; the RTI includes the fee and appellate lines.
**T17 — files:** `public/sw.js`, `lib/offline.ts` *AC:* AC6.1, AC6.3. *Verify:* DevTools → Network → Offline, then reload. **Must be tested on the deployed HTTPS URL, not only localhost.**
**T18 — files:** `lib/offline.ts`, `components/SyncBadge.tsx` *AC:* AC6.2, AC6.4. *Verify:* offline-file → back online → count hits 0 → the row appears in the list.
**T19 — files:** `lib/i18n.ts`, `app/api/translate/route.ts` *AC:* AC5.1–AC5.3. *Verify:* switch to Tamil, reload, confirm no second network call (Network tab).

---

## Phase 2 — Should-have (2:15–3:25)

Start only when every P0 above passes. Drop any of these without regret.

| # | Task | Owner | P | Est | Depends on |
|---|---|---|---|---|---|
| T20 | `/api/stats` from real complaint data; 2 charts + hotspot table | C | P1 | 25m | T13, T2 |
| T21 | `/api/route` on OSRM, with the cached fallback verified | C | P1 | 20m | T3 |
| T22 | `/api/pass` signing + offline verify on a second device | C | P1 | 20m | T3 |
| T23 | Tune `/api/verify-message` with 3 real WhatsApp forwards | B | P1 | 15m | T2 |
| T24 | `/api/day-plan` ordering that respects office hours | B | P1 | 15m | T21 |
| T25 | Offline OCR via Tesseract.js, confirmed in airplane mode | A | P1 | 15m | T17 |
| T26 | `/api/rating` scorecard write + policy simulator check | C | P2 | 15m | T20 |
| T27 | Kiosk mode and large-touch pass over every screen | A | P2 | 10m | — |
| T28 | `supabase/schema.sql` + seed, if Supabase is wired at all | C | P2 | 20m | — |

**T20 *AC:*** charts render from live rows, and with no Supabase they render from `DEMO_STATS`.
**T21 *AC:*** distance, duration, fare and steps shown; `source` reports `osrm` or `fallback` honestly.
**T22 *AC:*** a pass generated on phone 1 verifies on phone 2 **in airplane mode**; a tampered payload fails.
**T25 *AC:*** with the network off, a photo yields readable text (slow first load is acceptable).

---

## Phase 3 — Hardening, testing, submission (3:25–4:00) · do not compress

| # | Task | Owner | P | Est |
|---|---|---|---|---|
| T29 | Run the full [TEST_PLAN.md](TEST_PLAN.md) primary journey | all | P0 | 15m |
| T30 | Loading / empty / error state sweep on all 10 screens | A | P0 | 10m |
| T31 | Record the 3-minute fallback screen capture | B | P0 | 10m |
| T32 | Final deploy; confirm the live URL on the demo phone | A | P0 | 5m |
| T33 | README: what is real, what is roadmap, env vars, run steps | B | P0 | 10m |
| T34 | Final commit and push; confirm GitHub shows everything | C | P0 | 5m |

**T29 *Verify:*** the journey runs twice end to end, once with the network off, with no console error.
**T30 *AC:*** no screen can show a spinner forever; every list has an empty state; no raw error text.
**T31 *AC:*** a video file exists locally that shows the whole journey — insurance against venue wifi.
**T33 *AC:*** the README makes no claim of a government integration we do not have.

---

## Dependency graph

```
T1 ─┬─> T5 ─> T17 ─> T18 ─> T25
    │              └─> T29
T2 ─┼─> T6
    ├─> T20
    └─> T23
T3 ─┬─> T12 ─> T14
    ├─> T13 ─┬─> T15
    │        ├─> T16
    │        └─> T20
    ├─> T21 ─> T24
    ├─> T22
    └─> T26
T4 ─┬─> T7 ─> T8
    ├─> T11
    ├─> T16
    └─> T19
T9 ─> T10
all P0 ─> T29 ─> T32 ─> T34
```

**Critical path:** T1 → T3 → T12/T13 → T15/T16 → T29 → T32.
It runs through Person C, so **C must not be given extra work in Phase 0**.

---

## Parallel schedule

| Time | A — frontend/voice/offline | B — AI/logic | C — data/maps/dashboard |
|---|---|---|---|
| 0:00–0:25 | T1 install & build · T5 deploy | T4 key · T2 schemes.json | T3 stub the 7 handlers |
| 0:25–1:00 | T6 schemes UI · T8 scan UI | T2 finish · T7 extract prompt | T12 complaint + ward routing |
| 1:00–1:40 | T9 voice form · T10 PDF | T11 rejection · T16 letters | T13 list + timeline · T14 submit |
| 1:40–2:15 | T17 service worker · T18 sync | T19 translate · prompt QA | T15 escalation / RTI |
| 2:15–2:50 | T25 offline OCR · T27 kiosk | T23 fake-scheme · T24 day plan | T20 dashboard |
| 2:50–3:25 | T30 state sweep | T33 README | T21 route · T22 pass |
| 3:25–4:00 | T32 final deploy | T31 recording | T34 push |
| 3:40–4:00 | **T29 full journey, all three together** | | |

---

## Checkpoints

| Time | Must be true, or cut scope |
|---|---|
| 0:25 | `npm run build` passes · deployed URL loads · all 16 route handlers answer (9 AI + 7 data) |
| 1:00 | Scan → profile → schemes works end to end |
| 1:40 | Complaint files, routes to a ward, and the timeline opens |
| 2:15 | **All P0 done. Airplane-mode flow works.** If not: drop all of Phase 2 now. |
| 3:25 | Feature freeze. Nothing new after this line. |
| 4:00 | Deployed, pushed, recorded. |

---

## Cut order if you fall behind

Drop from the bottom. Never cut upward into the must-haves.

1. T28 Supabase schema → stay on `lib/demo.ts` entirely
2. T26 scorecard / simulator
3. T27 kiosk mode
4. T24 day plan
5. T22 signed pass
6. T21 transport route
7. T20 dashboard
8. T25 offline OCR
9. T23 fake-scheme checker

**Never cut:** T17/T18 (offline), T7/T8 (scan), T6 (schemes), T9 (voice), T12–T16 (complaint).
Those five are the demo.
