# Admin Dashboard & Catalogue Curation (Phase 2)

Phase 2 introduces a secured administrative interface and backend curation workflow for managing the Sahayak scheme catalogue.

## 1. Roles and Permissions

Three discrete roles govern the administrative lifecycle in FastAPI:

| Role | Capabilities | Restrictions |
|---|---|---|
| `editor` | Create scheme drafts, edit drafts, update schemes, submit schemes for review. | Cannot verify or publish schemes; cannot archive schemes; cannot view audit logs or manage admin accounts. |
| `reviewer` | All `editor` abilities + inspect submissions, approve & verify schemes against official government sources, request changes with mandatory reasons, and archive schemes. | Cannot view security audit logs or manage admin accounts. |
| `admin` | Full editorial and review capabilities + view paginated security audit trail and manage administrative accounts via CLI. | Public citizen-facing self-registration is never permitted. |

All role checks are enforced server-side as FastAPI route dependencies. Next.js UI hiding is purely for user experience; no sensitive action can be executed without backend authorization.

---

## 2. Authentication & Session Security

- **Password Hashing:** Uses Argon2id through `pwdlib[argon2]`. Plaintext passwords and reversible encryption are never stored or logged.
- **Session Tokens:** Server-side 32-byte cryptographically random opaque tokens (`secrets.token_urlsafe(32)`).
- **Token Hashing:** Only SHA-256 hashes of session tokens are stored in the `admin_sessions` table (`token_hash`). Raw tokens are never persisted in the database.
- **Cookie Delivery:** Raw session tokens are delivered exclusively via `HttpOnly` cookies (`sahayak_admin_session`) with `SameSite=Lax`.
- **CORS & Credentials:** Strict CORS configuration (`CORS_ALLOW_ORIGINS`) with `CORS_ALLOW_CREDENTIALS=true` and explicit origin validation. Wildcard origins (`*`) paired with credentials are forbidden.
- **CSRF & Origin Protection:**
  - State-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) require an `X-CSRF-Token` header.
  - The raw CSRF token is verified against `csrf_token_hash` in `admin_sessions`.
  - The request `Origin` header is checked against the configured trusted origins.
- **Rate Limiting:** Failed login attempts are rate-limited (max 5 failed attempts per 15-minute window per account/IP), returning HTTP 429 Too Many Requests. Generic error messages prevent account enumeration.
- **Revocation:** Explicit logout marks the session revoked in PostgreSQL and clears the browser cookie.

---

## 3. Scheme Review State Machine

```
              ┌────────────────────────────────────────┐
              │                                        ▼
[ Draft ] ──> [ Needs Review ] ──(Reviewer verify)──> [ Verified ]
    ▲                 │                                    │
    │                 ▼                                    │
    └──(Request changes with reason)                       │
                      │                                    │
                      ▼                                    ▼
                 [ Archived ] <────────────────────────────┘
```

1. **`draft` → `needs_review`:** Editor or Reviewer submits a draft with completed fields.
2. **`needs_review` → `verified`:** Reviewer or Admin approves the submission after verifying official sources. `verified_at` timestamp is recorded.
3. **`needs_review` → `draft`:** Reviewer or Admin requests changes, requiring an explanatory reason that is logged in the audit trail.
4. **`verified` / `needs_review` → `archived`:** Reviewer or Admin retires the scheme. No rows are permanently deleted.
5. **Automatic Invalidation upon Edit:** If an editor or admin modifies a `verified` scheme, its review status is immediately demoted to `needs_review` and `verified_at` is cleared. It is **immediately removed from public citizen endpoints** until re-verified.
6. **Optimistic Concurrency Control:** Write requests accept `expected_updated_at`. If another user modified the scheme in the interim, the update returns `HTTP 409 Conflict` to prevent silent overwrites.

---

## 4. Bootstrapping the First Administrator

Admin accounts are created and managed via the secure CLI tool, never via public registration or hardcoded seed credentials:

```bash
cd backend
source .venv/bin/activate

# Create first admin user (prompts for password without echo)
python -m app.cli create-admin --email "admin@example.gov.in" --role admin

# Change user role later
python -m app.cli change-role --email "admin@example.gov.in" --role reviewer
```
