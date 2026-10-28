# Privacy and data handling

Sahayak's users are citizens handling identity documents and income details. That makes privacy
a design constraint, not a compliance afterthought.

**Phase 0 status: the application stores no personal data at all.** There is no database schema,
no authentication, no document upload and no profile persistence. The rules below are the
commitments that govern every later phase.

---

## 1. Synthetic data only

**No real Aadhaar card, income certificate, caste certificate, ration card, bank passbook or any
other genuine citizen document is used in development, testing or demonstration.** Not the
team's own documents either — a developer's real Aadhaar in a test fixture is a leak waiting for
a public repository.

- Test data is invented: fictional names, invented numbers, invented addresses.
- Document identifiers in fixtures must be obviously fake and must not satisfy a real checksum.
- If a real document is ever needed to validate OCR, it is handled on one machine, never
  committed, never uploaded, and deleted immediately afterwards. Prefer a synthetic facsimile.
- Screenshots in documentation or a demo use synthetic data.

Enforced by review: a pull request introducing a document fixture must state that it is synthetic.

---

## 2. Data minimisation

Collect the minimum that answers the user's question, and keep it for the shortest time that
works.

| Commitment | Consequence |
|---|---|
| **Eligibility is stateless** in the first MVP | `POST /api/v1/eligibility/check` computes from the request body. No profile row, no answers row, no match row. |
| No profile persistence "for later" | A table is created in the phase that needs it, not in advance. |
| Document **metadata** only in Postgres | Never file bytes. Binaries go to a private bucket, if and when documents ship. |
| Answers are not logged | Request bodies containing eligibility answers must never reach application logs or an error tracker. |
| Match history is opt-in | `scheme_matches` is written only when a user explicitly asks to save a result. |

Rejected on purpose: storing every eligibility check "for analytics". It would turn a stateless
calculator into a database of citizens' income and caste, which is a far heavier thing to defend
than the feature is worth.

---

## 3. Consent

When a later phase does store something:

- **Say what, why and for how long** before it is stored, in the user's own language.
- **Opt-in, not opt-out.** No pre-ticked consent box.
- **Separate consents** for separate purposes. Agreeing to a document being read for extraction
  is not agreement to retain it.
- **Withdrawable.** Withdrawal deletes the data, not just a flag.
- **Record what was consented to**, and when, in `audit_events`.
- **No dark patterns.** Declining must stay as easy as accepting.

---

## 4. Secret handling

| Secret | Where it may exist |
|---|---|
| `DATABASE_URL` | Backend environment only |
| Admin session tokens | Raw in HttpOnly cookie; SHA-256 hash in database; never logged |
| Admin passwords | Argon2id hash only in database; never logged or returned |
| Supabase `service_role` key | Backend environment only — it **bypasses RLS** |
| Supabase JWT secret | Backend environment only |
| AI provider keys | Backend environment only |
| `NEXT_PUBLIC_API_BASE_URL` | Browser — it is a URL, not a credential |
| Supabase `anon` key | Browser-safe **by design**, but only where RLS is correctly configured |

Rules:
1. A secret never carries a `NEXT_PUBLIC_` prefix. That prefix inlines the value into the
   JavaScript bundle, where it is public forever.
2. `.env` files are git-ignored. Only `.env.example` is committed, with placeholders.
3. A leaked key is rotated in Supabase, not just removed from the code — git history keeps it.
4. Error messages and logs never contain a connection string, a token or a credential. The
   backend's health check deliberately logs only an exception's class name, because driver
   messages routinely include the host, user and password.
5. CI uses repository secrets, never hard-coded values.

---

## 5. Storage restrictions (when documents ship)

Not before Phase 3, and not before the isolation test in `database-schema.md` §4 passes.

- **Private buckets only.** No public bucket ever holds a citizen document.
- **Ownership checks on every access.** Each object belongs to one user; a request for someone
  else's object is denied, and the denial is tested.
- **File-size and MIME limits** enforced server-side, not only in the browser.
- **Postgres stores metadata**: owner, document type, bucket path, size, upload time, consent
  reference. Never the bytes.
- **Signed URLs are short-lived**, and never logged.
- **1 GB Free-tier storage** means a per-user quota and a retention window are mandatory, not
  optional.

---

## 6. Deletion and retention

| Data | Retention | Deletion |
|---|---|---|
| Eligibility answers (MVP) | Not stored | Nothing to delete |
| Saved schemes | Until the user removes them or deletes the account | Immediate |
| Documents | Shortest window that serves the purpose; a stated maximum | User-initiated, and the object is removed from the bucket, not just the row |
| Profile | Until account deletion | `on delete cascade` from `auth.users` |
| Audit events | Longer, deliberately — they are the record of who did what | Retained after account deletion only in de-identified form |
| Complaints | Civic record; may outlive the account | Author identity detachable |

Commitments:
- **Account deletion means data deletion**, including bucket objects — not a soft-delete flag.
- Deletion is reachable in the UI, not only by asking support.
- A user can see what is held about them before deciding to delete it.
- Deletion of a cascade parent must be tested, so orphaned personal rows cannot survive.

---

## 7. What the product may never claim

Honesty is a privacy control: a citizen who trusts a wrong answer acts on it.

- Never present an eligibility result as an official determination. It is **indicative**, and
  every surface showing one says so.
- Never imply an integration we do not have — DigiLocker, Aadhaar authentication, a department
  portal, a grievance system.
- Never fabricate a field from an unreadable document. Low confidence is a valid answer.
- Never state that Row Level Security protects data that is reached through a connection which
  bypasses it.
- Never show a scheme that has not been verified against its department's own source.

---

## 8. Open items before any personal data is stored

| Item | Blocks |
|---|---|
| Choose and test one access-control approach (FastAPI authorisation vs RLS) | Phase 4 |
| Write and pass the User A / User B isolation test | Phase 3 and 4 |
| Decide document retention window and per-user quota | Phase 3 |
| Decide consent wording, and its translations | Phase 3 |
| Confirm logs and the error tracker exclude request bodies | Phase 2 |
