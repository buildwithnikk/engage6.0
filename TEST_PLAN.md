# TEST PLAN — Sahayak

Manual test plan. There is no automated test suite and we are not writing one inside 4 hours
([DECISIONS.md](DECISIONS.md) D9). Everything below is executable by hand in minutes.

**Test on the deployed HTTPS URL on a real Android phone in Chrome.** Service workers,
`getUserMedia`, Web Speech and Geolocation all behave differently on `localhost` than on the
device you will demo from. Desktop Chrome is for debugging only.

---

## 1. Primary end-to-end journey

This is the demo. It must run twice without a failure, once with the network off.

| Step | Action | Expected |
|---|---|---|
| 1 | Open the deployed URL on the phone | Home loads; header shows sync badge and language switcher; Hindi by default |
| 2 | Switch language to Hindi, reload | Still Hindi (persisted) |
| 3 | Home → read the unclaimed figure aloud | A rupee figure in Indian format; TTS speaks it |
| 4 | Scan → photograph a document | Extraction completes in <15s; ≥5 fields populated |
| 5 | Edit one field, save | Field accepts the edit; confirmation shown |
| 6 | Observe the mismatch card | A high-risk name mismatch with Hindi advice, readable aloud |
| 7 | Go to Schemes | ≥5 eligible, ≥2 near-miss; total equals the sum of the eligible list |
| 8 | Read a near-miss entry | Names exactly one missing document and the value it unlocks |
| 9 | Form → "Why is this asked?" | Reason + the common rejection mistake |
| 10 | Answer a field by voice in Hindi | Transcript lands in the input |
| 11 | Complete the fields, download the PDF | PDF opens; every answer present |
| 12 | Paste `PFMS: Account not seeded` → decode | Plain-language cause + ≥3 ordered, doable steps |
| 13 | **Turn on airplane mode** | Badge switches to offline |
| 14 | Reload the app | App still opens from cache |
| 15 | Complaint → photograph a pothole | Classification appears (fallback is fine) |
| 16 | Submit the complaint | "Saved offline" in Hindi; badge shows 1 pending |
| 17 | **Turn airplane mode off** | Queue flushes automatically; pending returns to 0 |
| 18 | Open the complaint | Id, ward, department and a timeline |
| 19 | On an old complaint, tap Escalate, then RTI | Two letters, each naming an authority, citing the id and elapsed days |
| 20 | Transport → pick an office → route | Distance, duration, fare and steps |
| 21 | Generate a pass; verify on a second phone **in airplane mode** | Second phone reports a valid pass |
| 22 | Dashboard | Charts render; ward comparison is legible |

**Pass condition:** steps 1–19 complete with no blank screen, no spinner stuck past 20s, and no
uncaught console error. Steps 20–22 are should-have; their failure does not fail the journey.

---

## 2. Invalid input and edge cases

| # | Input | Expected |
|---|---|---|
| E1 | Photograph a blank wall on Scan | Low confidence or empty fields with a readable message. **Never** fabricated personal data. |
| E2 | Upload a 12 MB photo | Either compressed/accepted, or a clear size message. No silent hang. |
| E3 | Cancel the camera picker | Nothing changes; no error |
| E4 | Submit the voice form with every field empty | PDF still generates with `—` placeholders, or submission is blocked with a readable reason — one or the other, chosen deliberately |
| E5 | Type a non-numeric income | Not stored as `NaN`; eligibility does not silently treat it as 0 |
| E6 | Paste 5,000 characters into the rejection decoder | Truncated or handled; no 500 |
| E7 | Paste an empty string into the fake-scheme checker | Button disabled or an explicit prompt |
| E8 | Deny the location permission on Complaint | Falls back to the demo coordinates; flow continues |
| E9 | Submit a complaint with no photo | Blocked with a readable reason, or accepted with a text-only description — pick one |
| E10 | Open `/complaint/DOES-NOT-EXIST` | Readable "not found", not a crash |
| E11 | Verify a tampered pass (edit one character of the payload) | **Must report invalid.** A false valid here is the worst bug in the app. |
| E12 | Verify malformed JSON on `/verify` | "Verification failed", no uncaught exception |
| E13 | Reload mid-flow on the form | Either resumes or restarts cleanly; no half-rendered page |
| E14 | Open the app in a private window | Works; IndexedDB absence degrades persistence only |
| E15 | Switch language while a request is in flight | No stuck spinner, no mixed-language screen |
| E16 | Profile with income above every threshold | Empty eligible list with a real empty state, not a blank area |

---

## 3. API and AI failure cases

Simulate with DevTools → Network → **Block request URL**, or by unsetting the key and redeploying.

| # | Failure | Expected | Where it is handled |
|---|---|---|---|
| F1 | `GEMINI_API_KEY` unset | Every AI route returns `lib/demo.ts` data with `_source: "fallback"`; UI identical | `lib/gemini.ts` |
| F2 | Gemini returns 429 (rate limit) | Text routes fall through to Groq; vision routes go straight to fallback | `lib/gemini.ts` |
| F3 | Gemini takes >12s | Timeout fires, fallback returned | `callModel` timeout |
| F4 | Gemini returns prose instead of JSON | Fence-stripping parse; on failure, fallback | `parseJson` |
| F5 | Both Gemini and Groq fail | Fallback returned, HTTP 200, UI renders | `lib/gemini.ts` |
| F6 | Nominatim blocked or 429 | Named fallback ward; complaint still files | `lib/geo.ts` |
| F7 | OSRM blocked | `DEMO_ROUTE` with `source: "fallback"` | `lib/osrm.ts` |
| F8 | Supabase env vars absent | Routes serve demo data; no screen errors | `lib/supabase.ts` |
| F9 | Supabase reachable but the insert fails | Write queues rather than vanishes | `postOrQueue` |
| F10 | Every network request blocked | Cached shell opens; writes queue; reads show cached or demo data | service worker + Dexie |
| F11 | IndexedDB throws (private window) | Features degrade; no page crash | `lib/db.ts` |
| F12 | Web Speech unsupported (non-Chrome) | Typing fallback visible; no dead mic button | `VoiceInput` |
| F13 | TTS voice missing for the language | Button does nothing harmful; no exception | `SpeakButton` |
| F14 | Geolocation times out | Demo coordinates after ≤6s | complaint/transport pages |
| F15 | Service worker serves a stale build | Hard reload recovers; note it before the demo | `public/sw.js` |

**Rule for all of the above: HTTP 200 with a degraded, correctly shaped answer beats a 500.**
A judge who sees a stack trace stops watching the demo.

---

## 4. Loading, empty and error states

Check every one of the 10 screens.

| State | Requirement |
|---|---|
| Loading | Any wait >300ms shows a spinner or skeleton with text in the current language. No wait may exceed 20s with no resolution. |
| Empty — schemes | "No scheme matched this profile" + what to change. Never a blank area. |
| Empty — complaints | "No complaints in your area yet" + the file-one action |
| Empty — dashboard | Charts render from `DEMO_STATS` rather than an empty frame |
| Empty — offline queue | "Nothing pending" |
| Error — extraction failed | Readable message + retry + the offline-OCR alternative |
| Error — network write | "Saved offline, will send when you are back online", in the user's language |
| Error — not found | Readable copy, with a way back |
| Disabled controls | A button that cannot act is visibly disabled, never silently inert |
| No raw internals | No stack trace, no `undefined`, no `[object Object]`, no English-only error on a Hindi screen |

**Screen checklist:** `/` · `/schemes` · `/scan` · `/form` · `/complaint` · `/complaint/[id]` ·
`/transport` · `/dashboard` · `/verify` · `/settings`

---

## 5. Build and submission checks

Run in order. All must pass before you call it done.

```bash
# 1. Clean install from the lockfile, exactly as the deploy does
rm -rf node_modules .next && npm ci

# 2. Production build must succeed
npm run build

# 3. Types — informational only (next.config.js ignores errors at build time)
npm run typecheck

# 4. Serve the production build and smoke-test every route
npm start
```

```bash
# 5. Every API route answers with the right shape, with NO keys set
for r in match complaints stats; do echo "--- $r"; curl -s localhost:3000/api/$r | head -c 200; echo; done
curl -s -X POST localhost:3000/api/match -H 'content-type: application/json' -d '{}' | python3 -m json.tool | head -20
```

```bash
# 6. No secret leaked into the client bundle — must print nothing
grep -rl "GEMINI_API_KEY\|GROQ_API_KEY\|PASS_PRIVATE_KEY" .next/static 2>/dev/null
```

```bash
# 7. .env.local must not be tracked — must print nothing
git ls-files | grep -F ".env.local"
```

```bash
# 8. Everything committed and pushed
git status --short && git log --oneline -3
```

**Manual submission checks**
- [ ] Deployed HTTPS URL opens on a phone that is not the developer's laptop
- [ ] The primary journey (§1) passes on that phone
- [ ] Airplane-mode steps 13–17 pass on that phone
- [ ] The 3-minute fallback recording exists and plays
- [ ] README states what is real and what is roadmap
- [ ] No screen claims a DigiLocker / Aadhaar / CPGRAMS / Bhashini integration
- [ ] Eligibility output is labelled indicative, not an official determination
- [ ] No real person's documents or data anywhere in the repo or the demo
- [ ] `git log` shows work from all three people
