# 🏛️ Sahayak — Citizen Operating System

**Hackathon theme:** Better Communities, Better Governance
**Constraint:** 3 hours · team of 3 · only free, publicly available APIs

> *Internet ho ya na ho, smartphone ho ya na ho — har citizen tak sarkar pahunchegi.*

---

## The core idea

```
1 Next.js app  +  1 Gemini key  +  1 Supabase project  =  8 modules
```

Every module is **one page + one API route**. No separate backend, no second model, no extra
service. That is the only reason 8 modules fit in 3 hours.

---

## Modules

| # | Module | What it does |
|---|---|---|
| 1 | **Scheme & Scholarship Discovery** | Matches a profile against 40 schemes, shows "₹42,000/yr unclaimed", and "1 document away from 3 more" |
| 2 | **Document Scan → Auto-Profile** | Photo of Aadhaar/income certificate → structured profile + name-mismatch warning + expiry reminders |
| 3 | **Form Helper + Rejection Decoder** | Fills a real PDF by voice in Hindi; explains every field; decodes a rejection letter into fix steps |
| 4 | **Civic Complaints + Escalation** | Photo + GPS → auto-classified → routed to the right ward → auto-drafts escalation, then an RTI |
| 5 | **Multilingual & Voice-First** | 8 languages, voice in and audio out on every screen, audio explainers of government circulars |
| 6 | **Transparency Dashboard** | Complaints per ward, median resolution time, anonymous office scorecard, policy simulator |
| 7 | **Transportation Ease** | Bus/auto route to the office a scheme needs, "Ek din, saare kaam" trip planner, offline-verifiable signed QR pass |
| 8 | **Offline + Online (Phygital)** | Installable PWA, offline write queue with auto-sync, offline OCR, offline QR verify, kiosk mode |

---

## Stack — all free, nothing approval-gated

| Layer | Choice |
|---|---|
| App | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| LLM / vision / translate | **Google Gemini 2.0 Flash** (free tier, no card) |
| LLM fallback | **Groq** Llama 3.3 70B (free tier) |
| Voice | **Web Speech API** + **SpeechSynthesis API** (browser native) |
| Offline OCR | Tesseract.js |
| Database / storage | **Supabase** free tier (Postgres + PostGIS) |
| Maps | MapLibre GL + OpenStreetMap tiles |
| Geocoding | Nominatim (OSM) |
| Routing | OSRM demo server |
| Eligibility | json-logic-js (deterministic — the model never decides eligibility) |
| PDF | pdf-lib |
| Charts | Recharts |
| Offline | next-pwa (Workbox) + Dexie.js |
| Signed QR | @noble/ed25519 + qrcode |
| Hosting | Vercel free tier |

**Deliberately avoided** (signup approval / KYC / paid — fatal inside 3 hours):
Bhashini, DigiLocker & API Setu, WhatsApp Cloud API, Twilio, Exotel, Neo4j, custom YOLO training.
These go on the roadmap slide.

---

## Team split

| Person | Owns |
|---|---|
| **A — Frontend** | App shell, shared voice components, i18n, scan & form screens, PWA + offline sync, polish, deploy |
| **B — AI** | `lib/gemini.ts`, every prompt and API route, `schemes.json`, the eligibility engine |
| **C — Backend** | Supabase schema & seed, maps, complaint routing, OSRM transport, signed QR, dashboard |

Full minute-by-minute task lists are in **[`Sahayak_Hackathon_Plan.xlsx`](Sahayak_Hackathon_Plan.xlsx)**:

- `0. Overview` — rules of engagement
- `1. Modules` — all 8 modules, scope, tech, owner, priority
- `2–4. Person A / B / C` — every task with a definition of done and the files to touch
- `5. Timeline` — 3 hours, all three in parallel, with checkpoints
- `6. Tech Stack` — every library and API with its signup link
- `7. API Contracts` — exact route shapes, locked at 0:20 so nobody blocks
- `8. Demo Script` — the 3-minute stage run

---

## Five rules that decide whether this ships

1. **Deploy at 0:45, then keep redeploying.** Most teams lose the demo to a last-minute build failure.
2. **Cache every Gemini response in Dexie.** Free tier is 15 req/min — a live demo must never depend on a fresh call.
3. **Every module ships with hardcoded demo-data fallback.** If an API dies on stage, the UI still works.
4. **API shapes are frozen at 0:20.** Not ready? Return canned JSON of the same shape.
5. **Person A owns the shared components.** B and C consume them; nobody else edits them.

---

## Getting started

```bash
npx create-next-app@latest . --ts --tailwind --app
npm i @google/generative-ai json-logic-js dexie maplibre-gl pdf-lib qrcode \
      @noble/ed25519 next-pwa recharts tesseract.js @supabase/supabase-js lucide-react
```

```bash
# .env.local
GEMINI_API_KEY=         # aistudio.google.com/apikey
GROQ_API_KEY=           # console.groq.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
PASS_SIGNING_SECRET=    # Ed25519 private key for QR passes
```
