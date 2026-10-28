# ARCHITECTURE — Sahayak

Describes the architecture **already present** in the repository and the rules that keep three
people working in it for four hours without blocking each other.

Scope note: this is the simplest architecture that satisfies [REQUIREMENTS.md](REQUIREMENTS.md).
No microservices, no separate Python backend, no queue, no ORM, no state-management library,
no auth. Each of those was considered and rejected in [DECISIONS.md](DECISIONS.md).

---

## 1. Shape

One Next.js 14 App Router deployment. Client components do the interaction; route handlers do
anything that needs a secret or a third party.

```
┌──────────────────────────── Browser (the whole UI) ────────────────────────────┐
│  app/*/page.tsx          client components, "use client"                        │
│  components/             BottomNav · LangProvider · LangSwitch · SyncBadge      │
│                          voice/VoiceInput · voice/SpeakButton · voice/CameraInput│
│                                                                                 │
│  Browser-native, no key, no server:                                             │
│    Web Speech (STT) · SpeechSynthesis (TTS) · Geolocation · getUserMedia        │
│    pdf-lib (fills the PDF) · Tesseract.js (offline OCR)                         │
│    @noble/ed25519 (verifies a pass offline)                                     │
│                                                                                 │
│  Local state: Dexie/IndexedDB  — profile · offline write queue · response cache │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │ fetch (JSON only)
┌───────────────────────────────────▼────────────────────────────────────────────┐
│  app/api/*/route.ts  — thin handlers. Validate, call lib/, always return the    │
│                        documented shape.                                        │
├────────────────────────────────────────────────────────────────────────────────┤
│  lib/  — all logic lives here, not in pages and not in routes                   │
│    gemini.ts       the ONLY model caller (Gemini → Groq → caller's fallback)     │
│    eligibility.ts  json-logic over data/schemes.json — deterministic             │
│    geo.ts          Nominatim reverse geocode + department lookup table           │
│    osrm.ts         OSRM routing + fare estimate                                  │
│    sign.ts         Ed25519 sign / verify                                         │
│    supabase.ts     client, or null when unconfigured                             │
│    demo.ts         the fallback universe — every route's safety net              │
│    db.ts offline.ts i18n.ts types.ts                                             │
└───────────────────┬──────────────────────┬──────────────────────┬──────────────┘
                    │                      │                      │
              Gemini 2.0 Flash      Nominatim / OSRM         Supabase
              (+ Groq fallback)     (OSM, keyless)        (optional; null → demo.ts)
```

**Why the AI calls go server-side:** `GEMINI_API_KEY` must never reach the browser. Everything
that needs no secret (speech, PDF, OCR, QR verification) stays in the browser, which is also
what makes those features work offline.

---

## 2. Folder and file responsibilities

| Path | Responsibility | Owner |
|---|---|---|
| `app/layout.tsx` | Shell: header, `LangProvider`, `SyncBadge`, `BottomNav`. The only global chrome. | A |
| `app/page.tsx` | Home: unclaimed-value headline, four tiles, fake-message checker. | A |
| `app/schemes/page.tsx` | M1 UI: eligible list, near-miss list. | A |
| `app/scan/page.tsx` | M2 UI: camera → `/api/extract` → editable profile → IndexedDB. | A |
| `app/form/page.tsx` | M3 UI: voice Q&A, client-side PDF, rejection decoder. | A |
| `app/complaint/page.tsx` | M4 UI: photo + GPS → classify → submit (via `postOrQueue`). | C |
| `app/complaint/[id]/page.tsx` | M4 UI: timeline, escalation and RTI drafts. | C |
| `app/transport/page.tsx` | S2/S3/S5 UI: route, day plan, signed pass. | C |
| `app/dashboard/page.tsx` | S1/S7/S8 UI: charts, scorecard, policy simulator. | C |
| `app/verify/page.tsx` | S3: offline pass verification. Pure client, no fetch. | A |
| `app/settings/page.tsx` | M5/M6/S6/S9: language, sync, offline OCR, kiosk, delete my data. | A |
| `app/api/*/route.ts` | One concern each. No business logic — it calls `lib/`. | B (AI routes) / C (data routes) |
| `components/` | Shared, presentational. **A owns every file here.** | A |
| `lib/` | All logic. Importable from both a page and a route. | per file, above |
| `data/schemes.json` | The scheme corpus + json-logic rules. Hand-checked. | B |
| `supabase/schema.sql` | Table definitions and RLS. Optional to run. | C |
| `public/sw.js` | Service worker: cache-first shell for offline. | A |

**Rules**
1. A page never calls Gemini, Nominatim or OSRM directly. It calls an own-origin `/api/*` route.
2. A route never contains logic worth testing. It unwraps the request, calls `lib/`, returns JSON.
3. `lib/` never imports from `app/`. Dependencies point one way only.
4. Only `lib/gemini.ts` talks to a model.
5. Only `lib/offline.ts#postOrQueue` performs a write. That single chokepoint is what makes the
   whole app offline-capable rather than one screen.
6. Only `components/LangProvider.tsx` owns language state; screens read it through `useLang()`.

---

## 3. Component boundaries

**Shared, owned by A — consumed everywhere, edited by nobody else**

| Component | Contract | Why it is shared |
|---|---|---|
| `VoiceInput` | `onResult(transcript: string)`, optional `label` | One place handles the Chrome-only API, language code and the unsupported-browser fallback |
| `SpeakButton` | `text: string` | One place handles cancel/replay and voice selection |
| `CameraInput` | `onImage(base64, mimeType, previewUrl)` | One place handles rear camera, file reading and preview |
| `SyncBadge` | none | Single source of truth for online state and the pending count |
| `LangProvider` / `useLang()` | `{ lang, setLang, t, speechCode }` | Language cannot be per-screen state |
| `ui/Section`, `ui/Owner` | `title`, `subtitle` / `who`, `module` | Visual consistency, and the owner label doubles as a map back to the task sheet |

If a screen needs different behaviour from a shared component, it **extends the component's
props**; it does not fork the component. Three people editing `VoiceInput` in hour three is the
most likely way this repo breaks.

---

## 4. Data flow

### 4.1 Read path — scheme discovery (no model, no network)
```
schemes/page.tsx
  → loadProfile()           lib/db.ts        IndexedDB
  → POST /api/match         { profile }
      → matchSchemes()      lib/eligibility.ts
          → json-logic over data/schemes.json
      ← { eligible[], nearMiss[], totalUnclaimed, bestNextDocument }
  → render
```
Deterministic by design: same profile, same answer, every time, with no connectivity.

### 4.2 Model path — document extraction
```
scan/page.tsx  (CameraInput → base64)
  → POST /api/extract  { imageBase64, mimeType }
      → callModel(prompt + image, json: true, fallback = DEMO_EXTRACT)
          1. Gemini 2.0 Flash, 12s timeout
          2. Groq — skipped for image input (no vision)
          3. DEMO_EXTRACT                       ← never throws
      ← ExtractResult + _source: gemini|groq|fallback
  → user edits → saveProfile() → IndexedDB → feeds 4.1 and M3
```
`_source` is in every model response on purpose: during the demo you can see instantly whether
an answer was live or served from the fallback.

### 4.3 Write path — complaint (the offline case)
```
complaint/page.tsx
  → POST /api/classify  { imageBase64, lat, lng }      (model, falls back)
  → postOrQueue("/api/complaint", payload)             lib/offline.ts
       online  → POST → { id, ward, department, status }
       offline → Dexie queue  → UI: "saved offline"
                 window 'online' → flushQueue() → SyncBadge count → 0

/api/complaint
  → reverseGeocode(lat,lng)   lib/geo.ts    Nominatim → ward, or named fallback
  → departmentFor(category)   lookup table, never the model
  → supabase insert, or in-memory demo store when unconfigured
```

### 4.4 Language path
```
LangProvider (lang changes)
  → ensureLanguage(lang)   lib/i18n.ts
      hi | en  → bundled STRINGS                       no network
      other    → Dexie cache hit → use it
                 miss → POST /api/translate → cache → use it
                 failure → fall back to Hindi strings
```

---

## 5. Error handling

**Principle: a failure degrades one feature's quality. It never produces a blank screen, an
unhandled rejection, or a thrown error during the demo.**

| Layer | Rule | Implementation |
|---|---|---|
| Model | Never throw | `callModel` tries Gemini, then Groq (text only), then returns the caller's fallback. 12s timeout. |
| API route | Always return the documented shape with HTTP 200 for a degraded answer | Every handler passes a `lib/demo.ts` fallback into `callModel`; reserve non-200 for a malformed request |
| Third-party geo | Treat failure as normal | `reverseGeocode` → named fallback ward; `routeBetween` → `DEMO_ROUTE` |
| Database | Optional dependency | `supabase` is `null` without env vars; routes must branch on `hasSupabase` |
| Browser storage | Wrap every access | IndexedDB can be empty or throw in a private window; `lib/db.ts` returns `null` server-side and callers tolerate `null` |
| Speech | Capability check, not assumption | `VoiceInput` detects support and renders a typing fallback |
| Geolocation | Always a fallback coordinate | Denied or timed out → Sitapur demo coordinates, so the flow continues indoors |
| Network writes | Queue, never lose | `postOrQueue` → Dexie → auto-flush |
| Page render | Fail soft | Every `fetch` in a page has `.catch`; absent data renders a loading or empty state, never a crash |
| Build | Never block a deploy | `next.config.js` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` — a deliberate hackathon-only choice (DECISIONS.md D8) |

**What we deliberately do not do:** no retry storms (one retry, then fall back), no global error
boundary theatre, no toast for a fallback the user does not need to know about.

---

## 6. Security boundaries

| Boundary | Rule |
|---|---|
| API keys | Server-side only. `GEMINI_API_KEY`, `GROQ_API_KEY`, `PASS_PRIVATE_KEY` are never prefixed `NEXT_PUBLIC_` and never reach the client bundle. |
| Public by design | `NEXT_PUBLIC_SUPABASE_*` and `NEXT_PUBLIC_PASS_PUBLIC_KEY` are public on purpose — the anon key is meant to be, and the public key must be, so a pass verifies offline. |
| Document images | Sent to the model for extraction, not persisted server-side in the prototype. The profile stays in IndexedDB on the device. |
| "Delete my data" | `app/settings/page.tsx` clears profile, cache and queue. It must work, and it must be honest about clearing only this device. |
| Anonymous complaints | When `anonymous` is set, no identifying field may be written. Fear of retaliation is the reason the toggle exists. |
| Pass signing | Private key server-side; verification is public-key only, so a conductor's offline phone can verify but not mint. |
| No auth, no accounts | Nothing to leak. A shared phone must not expose a previous user's data — which is why "delete my data" is a feature, not a setting. |
| Supabase RLS | `anon` may insert complaints and ratings, and read aggregates. It must not read personal rows. |
| Model input | Never paste a real citizen's documents into the demo. Demo data only. |
| Honesty boundary | No screen may imply a DigiLocker, Aadhaar, CPGRAMS or Bhashini integration. Eligibility output is indicative, and labelled as such. |

---

## 7. Integration points

### 7.1 External

| Service | Used by | Keyless? | Failure mode |
|---|---|---|---|
| Gemini 2.0 Flash | all 9 AI routes via `lib/gemini.ts` | key, free tier | → Groq → `demo.ts` |
| Groq (Llama 3.3) | text-only routes, automatic | key, free tier | → `demo.ts` |
| Nominatim | `/api/complaint` via `lib/geo.ts` | keyless | → named fallback ward |
| OSRM demo server | `/api/route` via `lib/osrm.ts` | keyless | → `DEMO_ROUTE` |
| Supabase | data routes | anon key | → in-memory demo data |
| Web Speech / SpeechSynthesis | `VoiceInput`, `SpeakButton` | browser | → typing fallback |

### 7.2 Internal — the module seams that matter

These are where one person's work meets another's. Agreed shapes live in `lib/types.ts` and must
not change after the first 20 minutes.

| Seam | Producer | Consumer | Contract |
|---|---|---|---|
| Profile | M2 scan (A+B) | M1 schemes, M3 form | `Profile` in IndexedDB under `"me"` |
| Scheme corpus | `data/schemes.json` (B) | `/api/match`, policy simulator, fake-scheme checker | `Scheme[]` |
| Classification | `/api/classify` (B) | complaint submit (C) | `CivicClass` |
| Complaint row | `/api/complaint` (C) | timeline, `/api/draft`, dashboard | `Complaint` + `ComplaintEvent[]` |
| Offices | `lib/demo.ts#DEMO_OFFICES` (C) | `/api/route`, `/api/day-plan` | `{id,name,lat,lng,type}` |
| Translations | `/api/translate` (B) | `LangProvider` (A) | `{ translations: string[] }`, same order and length |
| Write queue | `postOrQueue` (A) | every write in the app | `PostResult<T>` |
| Pass | `/api/pass` (C) | `app/verify` (A) | `{ payload, signature, publicKey }` |

**The anti-blocking rule:** a route that is not ready returns its `lib/demo.ts` fallback at the
correct shape. Nobody waits for anybody. This is also the mechanism that makes the demo
network-proof — the fallback path is exercised constantly during development, not written at the end.
