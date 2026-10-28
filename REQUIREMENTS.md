# REQUIREMENTS — Sahayak

**Status:** scaffold exists, application incomplete. See [TASKS.md](TASKS.md) for what is left.
**Budget:** 4 hours · 3 people (A, B, C) · AI-assisted development available.

Throughout these documents:
- **[FACT]** = verified in the repository or in published public documentation.
- **[ASSUMPTION]** = our judgement, not verified. Anything load-bearing is listed in [DECISIONS.md](DECISIONS.md).

---

## 1. Problem statement

An Indian citizen entitled to government benefits usually fails to receive them for reasons
that have nothing to do with eligibility:

1. They do not know the scheme exists.
2. They cannot read the eligibility rules or the form.
3. Their application is rejected for a clerical mismatch, with no explanation they can act on.
4. When they complain about a civic problem, nothing happens and there is no way to escalate.
5. Every step needs a smartphone, data, literacy, and a trip that costs a day's wages.

**What we are building:** one mobile web app that turns a photograph of the documents a citizen
already holds into a list of benefits they are missing, fills the application by voice in their
own language, and files and escalates civic complaints — working with no network and no literacy.

**Theme fit [FACT, from the stated hackathon theme]:** "Better Communities, Better Governance" —
all four of its bullets (benefit discovery, understandable forms, complaint tracking, local
languages) map to must-have features below.

---

## 2. Target user

**Primary persona — Sunita Devi** *(the demo persona; also seeded in `lib/demo.ts`)*
- 37, daily-wage labourer, Sitapur district, Uttar Pradesh
- Annual household income ₹96,000; OBC; holds Aadhaar, ration card, bank passbook, income certificate
- Reads Hindi slowly; cannot read English
- Shares one Android phone with her son; network drops often in her village
- Has paid a cyber-café agent ₹300 before, to be told what she qualifies for

**Secondary users**
- **Student** chasing a post-matric scholarship before a deadline
- **Sahayak volunteer** (ASHA worker, SHG member, student) operating the app for several
  villagers on one phone, often offline
- **Official / journalist** reading the transparency dashboard

**Non-users (explicitly out of scope):** feature-phone-only users, screen-reader-dependent users.
Both are real and important; neither can be served honestly in 4 hours. See §6.

---

## 3. Core user stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US1 | citizen | photograph my documents and have my profile filled in | I do not have to type or know what to type |
| US2 | citizen | see every scheme I qualify for and its rupee value | I know what I am losing by doing nothing |
| US3 | citizen | be told which single document unlocks more schemes | I know what to get next |
| US4 | citizen | be warned when my name differs across documents | my application is not rejected for spelling |
| US5 | citizen | answer form questions by speaking Hindi | I can apply without reading or writing |
| US6 | citizen | get a filled, printable form | I can submit it at the office or CSC |
| US7 | citizen | understand why my application was rejected | I can fix it instead of giving up |
| US8 | citizen | photograph a civic problem and have it routed correctly | I do not need to know which department owns it |
| US9 | citizen | have an escalation and an RTI drafted when nobody acts | inaction has a cost |
| US10 | citizen | use the app with no network | my village's connectivity does not decide my entitlements |
| US11 | citizen | hear every screen read aloud in my language | literacy is not a precondition |
| US12 | official/journalist | see resolution performance per ward | delay is visible and comparable |
| US13 | citizen | know the bus, time and fare to the office | the trip does not cost me an unplanned day |

---

## 4. Must-have features and acceptance criteria

These are the features the demo depends on. Each must be demonstrable on a phone.

### M1 — Scheme discovery *(US2, US3)*
`app/schemes/page.tsx` · `app/api/match/route.ts` · `lib/eligibility.ts` · `data/schemes.json`

- [ ] AC1.1 `data/schemes.json` holds **at least 25** schemes, each with `id`, `name`, `dept`,
      `benefitAmount`, `docsRequired[]`, `applyUrl` pointing at a real `.gov.in` page, `officeType`, `rule`.
- [ ] AC1.2 Given the demo profile, `/api/match` returns ≥5 `eligible` and ≥2 `nearMiss` entries.
- [ ] AC1.3 Total unclaimed rupee value is displayed, formatted in the Indian system (`₹1,42,000`).
- [ ] AC1.4 Each `nearMiss` names exactly one missing document and the value it unlocks.
- [ ] AC1.5 Eligibility is computed **only** by `json-logic` on the profile. No model call decides it.
- [ ] AC1.6 Changing `income` in the profile changes the eligible set (verifiable in one click).

### M2 — Document scan to profile *(US1, US4)*
`app/scan/page.tsx` · `app/api/extract/route.ts`

- [ ] AC2.1 Photographing a document returns a profile with ≥5 populated fields.
- [ ] AC2.2 The profile persists to IndexedDB and is read back by M1 and M3 after a page reload.
- [ ] AC2.3 A name mismatch against the saved profile is shown as a **high-risk** warning with
      advice in Hindi, and is readable aloud.
- [ ] AC2.4 With `GEMINI_API_KEY` unset or the network down, the route still returns a valid
      `ExtractResult` from `lib/demo.ts` and the UI renders it. **No crash, no blank screen.**
- [ ] AC2.5 Extracted fields are editable before saving.

### M3 — Voice form-fill and rejection decoder *(US5, US6, US7)*
`app/form/page.tsx` · `app/api/explain-field/route.ts` · `app/api/explain-rejection/route.ts`

- [ ] AC3.1 Each question is spoken aloud in the selected language on demand.
- [ ] AC3.2 A spoken Hindi answer populates the field (Chrome). Typing works as fallback everywhere.
- [ ] AC3.3 Fields known from the M2 profile arrive pre-filled.
- [ ] AC3.4 "Download filled PDF" produces a PDF containing every answer, generated client-side.
- [ ] AC3.5 "Why is this asked?" returns a reason plus the common rejection mistake.
- [ ] AC3.6 Pasting `PFMS: Account not seeded` returns a plain-language cause and ≥3 ordered,
      physically actionable steps.

### M4 — Civic complaint, routing and escalation *(US8, US9)*
`app/complaint/page.tsx` · `app/complaint/[id]/page.tsx` · `/api/classify` · `/api/complaint` · `/api/complaints` · `/api/draft`

- [ ] AC4.1 Photo + GPS yields a category, severity and a complaint-ready description.
- [ ] AC4.2 Department is assigned by the `departmentFor()` lookup, not by the model.
- [ ] AC4.3 Ward comes from Nominatim reverse geocode; a rate-limit or failure falls back to a
      named ward rather than erroring.
- [ ] AC4.4 A filed complaint gets an id, appears in the list, and opens a status timeline.
- [ ] AC4.5 A complaint older than the escalation threshold exposes **Escalate** and **RTI**,
      each producing a printable letter addressed to a named authority.
- [ ] AC4.6 Anonymous mode hides identity in the submitted payload.

### M5 — Language and voice *(US11)*
`components/LangProvider.tsx` · `components/voice/*` · `/api/translate`

- [ ] AC5.1 Language switcher offers 8 languages and the choice survives a reload.
- [ ] AC5.2 Hindi and English render from the bundled `STRINGS` with **no** network call.
- [ ] AC5.3 A third language is fetched once, cached in IndexedDB, and served from cache after.
- [ ] AC5.4 Every screen has at least one "read aloud" control that works.
- [ ] AC5.5 Where speech recognition is unavailable, a visible typing fallback is offered — never a dead button.

### M6 — Offline *(US10)*
`lib/offline.ts` · `lib/db.ts` · `components/SyncBadge.tsx` · `public/sw.js`

- [ ] AC6.1 With the network off, the app's cached screens still open.
- [ ] AC6.2 A complaint filed offline is queued, and the UI says so in the user's language.
- [ ] AC6.3 The badge shows offline state and the pending count.
- [ ] AC6.4 On reconnect the queue flushes automatically and the pending count returns to zero.
- [ ] AC6.5 Every IndexedDB read and write is wrapped so a private window or blocked storage
      degrades the feature instead of breaking the page.

---

## 5. Should-have features

Built only after every must-have passes. Each is independently droppable.

| ID | Feature | Minimum bar |
|---|---|---|
| S1 | **Transparency dashboard** (M6 in the plan file) | 2 live charts + repeat-hotspot table from `/api/stats` |
| S2 | **Transport route** (M7) | OSRM distance/duration/fare to a chosen office, with cached fallback |
| S3 | **Signed QR pass** | Ed25519-signed pass that `app/verify/page.tsx` validates offline |
| S4 | **Fake-scheme checker** | Pasted forward returns real / fake / unclear with a reason |
| S5 | **One-day trip planner** | Pending tasks ordered into a single trip with total time and fare |
| S6 | **Offline OCR** | Tesseract.js reads a document photo with the network off |
| S7 | **Office scorecard** | Anonymous wait-time / bribe rating submits and persists |
| S8 | **Policy simulator** | Income-limit slider recomputes how many schemes open up |
| S9 | **Kiosk mode** | `?kiosk=1` enlarges controls for a shared tablet |

---

## 6. Out of scope

Not "bad ideas" — unbuildable or dishonest inside 4 hours. State them as roadmap, never as built.

| Excluded | Reason |
|---|---|
| DigiLocker / API Setu | Requires an approved organisation account **[FACT: public onboarding is approval-gated]** |
| Bhashini API | Requires registration and approval; cannot be relied on today **[ASSUMPTION on turnaround]** |
| WhatsApp Cloud API | Requires business verification |
| SMS / IVR / USSD (Twilio, Exotel, MSG91) | Paid and/or KYC-gated; the brief forbids paid APIs |
| Real portal submission (CPGRAMS, NSP) | No sandbox; submitting real grievances in a demo is wrong |
| Aadhaar auth / e-KYC / Face Auth | Licensed access; never to be simulated as real |
| Payments / UPI | No payment belongs in a prototype |
| Agentic auto-submit via Playwright | Automating live government portals from a demo is unsafe and unauthorised |
| Neo4j knowledge graph, zero-knowledge proofs, satellite prediction, mesh sync, AR navigation | Each needs more than the whole budget |
| Phone-OTP auth | Deliberately no accounts: data stays on the device (see DECISIONS.md D7) |
| Custom YOLO training | Hours of training for what a vision model already does |
| Feature-phone channels, screen-reader certification | Real users, no honest path in the budget |

---

## 7. Constraints

**[FACT] Hard constraints**
1. 4 hours, 3 people, one shared repository.
2. Every API must be free and publicly usable with no approval step and no card.
3. Must run on a mid-range Android phone in Chrome.
4. The demo must survive a dead or hostile network.
5. No real citizen data, ever. Demo data only.

**[FACT] Repository state, verified at the time of writing**
- Next.js 14 App Router, TypeScript, Tailwind. 10 pages and 9 AI routes written.
- `lib/` complete: `gemini`, `eligibility`, `demo`, `db`, `offline`, `geo`, `osrm`, `sign`, `i18n`, `types`, `supabase`.
- **Missing:** `data/schemes.json` (imported by `lib/eligibility.ts` — *the build fails without it*),
  and routes `/api/complaint`, `/api/complaints`, `/api/complaint/[id]`, `/api/route`, `/api/pass`,
  `/api/stats`, `/api/rating`, plus `public/sw.js`.
- Dependencies have never been installed; `npm run build` has never been run.
- No `AGENTS.md` or `CLAUDE.md` existed before this documentation pass.

**[FACT] Free-tier limits that shape the design**
- Gemini free tier is rate-limited per minute — a live demo must not depend on a fresh call.
- Nominatim asks for ≤1 request/second and a `User-Agent`.
- OSRM's public demo server offers no availability guarantee.
- Web Speech recognition is Chrome-only in practice.

**[ASSUMPTION] Assumptions**
1. Demo happens on a laptop or Android phone running Chrome, which we control.
2. Venue wifi may fail; airplane mode is a feature, not a risk.
3. Scheme rules hand-written from public pages are accurate enough for a prototype. **Every
   screen must say the result is indicative, not an official eligibility determination.**
4. Supabase is optional: with no keys, routes serve `lib/demo.ts` and the app still demos fully.

---

## 8. Definition of done

1. `npm run build` succeeds.
2. The app is deployed and reachable on a phone over HTTPS.
3. Every M1–M6 acceptance criterion passes on that deployment.
4. The [TEST_PLAN.md](TEST_PLAN.md) primary journey runs twice with no failure, once with the
   network off.
5. A fallback screen recording of the journey exists.
6. No screen claims a government integration we do not have.
