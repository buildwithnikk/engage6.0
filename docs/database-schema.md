# Database schema and Supabase plan

**Development runs on local PostgreSQL. Supabase is the deployment target.** The same
migrations apply to both — see §0 below.

**Phase 0 status: no migration has been written and no schema has been applied.** This document
is the plan. The first migration (`schemes`) is written in Phase 1, after the connection
approach below has been verified and the migration reviewed.

Canonical migration history: **`supabase/migrations/` only.** SQLAlchemy models map an existing
schema; they never create a second migration history, and Alembic is deliberately not used
(see `../DECISIONS.md`).

---

## 0. Two environments, one schema

| | Development | Deployment |
|---|---|---|
| Database | **Local PostgreSQL 16** | **Supabase PostgreSQL (Free)** |
| Setup | `./scripts/setup-local-db.sh` | Dashboard → Connect |
| Role | `sahayak_app` — not superuser, no `BYPASSRLS` | Project credentials |
| `DATABASE_URL` | `backend/.env`, written by the script | Deployment environment only |
| Migrations | `supabase/migrations/`, applied with `psql` | the same files, applied with `supabase db push` |

Why development is local:

1. **No developer needs cloud credentials.** A shared cloud database means a shared secret, and
   one person's experiment breaking everyone's work.
2. **Free-tier limits and pausing stop mattering during development** — 500 MB, 5 GB egress and
   the ~7-day pause are deployment concerns, not daily ones.
3. **Destructive mistakes stay local.** A wrong `drop table` costs a re-run of the setup script.
4. **It is faster** — no network round trip per query.

What this does **not** change: the migration history is still `supabase/migrations/` and only
that, the schema is identical in both, and the RLS reasoning in §4 applies to both. The local
role was created without `BYPASSRLS` precisely so local behaviour matches the cloud.

**Verified on 2026-10-28:** local PostgreSQL 16.15 connected, and `/api/v1/health` returned
`{"status":"ok","version":"0.1.0","database":"ok","detail":null}`. The Supabase path has **not**
been exercised yet — no project exists.

### Applying a migration locally

```bash
psql "postgresql://sahayak_app@127.0.0.1:5432/sahayak_dev" -f supabase/migrations/<file>.sql
```

### Resetting the local database

```bash
dropdb sahayak_dev && ./scripts/setup-local-db.sh
```

---

## 1. Supabase Free tier — verified limits (deployment)

Checked against Supabase's official documentation on 2026-10-28:

| Limit | Value | Source |
|---|---|---|
| Database size | **500 MB per project** | [billing](https://supabase.com/docs/guides/platform/billing-on-supabase) |
| File storage | **1 GB** | billing |
| Egress | **5 GB** | billing |
| Monthly active users | **50,000 MAU** (SSO not available on Free) | billing |
| Active Free projects | **2**, counted across all organisations where you are Owner or Admin | billing |
| Inactivity pausing | Low-activity projects are paused, measured over a **7-day period**; a warning email arrives about a week ahead | [free-project-pausing](https://supabase.com/docs/guides/platform/free-project-pausing) |
| Restoring | A paused project can be restored within **1 year**, data and configuration intact, via Dashboard → *Resume project* | free-project-pausing |
| Backups | Free has **no Point-in-Time Recovery** (paid add-on). Treat Free as having **no backup you can rely on** — take your own exports (§6). | billing |

**We do not use keep-alive traffic to evade pausing.** It wastes the free resources the platform
grants, and resuming is one click. If a judge or reviewer finds the project paused, resume it and
re-run the seed.

### What these limits mean for the design

1. **500 MB is plenty for the scheme catalogue** (a few hundred rows of text and JSONB) and
   nowhere near enough for document images. Documents therefore never go in Postgres.
2. **Metadata in Postgres, binaries in Storage.** When documents are introduced, Postgres holds
   `documents` rows pointing at objects in a private bucket.
3. **Paused-project risk makes seeding mandatory.** Schema and seed data live in Git so the whole
   database can be recreated from scratch.
4. **Two-project limit** means one shared development project at most, plus one spare. Do not
   create a project per developer.

---

## 2. Tables by phase

Supabase manages `auth.users`. **We never duplicate or redefine it**; `profiles.id` references
it when profiles are introduced.

### Phase 1 — scheme catalogue

| Table | Purpose |
|---|---|
| `schemes` | The verified scheme catalogue. Public read, verified rows only. |
| `scheme_sources` | Optional audit trail: which official source was checked, when, by whom. Add only if the `source_url` + `verified_at` columns on `schemes` prove insufficient. |

### Later phases — not designed in detail yet

| Table | Phase | Note |
|---|---|---|
| `profiles` | Auth phase | `id uuid primary key references auth.users(id) on delete cascade` |
| `saved_schemes` | Auth phase | A user's bookmarks |
| `scheme_matches` | Later | **Only** if a user explicitly asks to save a match. Never written automatically. |
| `documents` | Documents phase | **Metadata only** — never file bytes |
| `complaints`, `complaint_events` | Complaints phase | Civic grievance tracking |
| `offices`, `office_feedback` | Later | Office directory and anonymous feedback |
| `passes` | Later | Signed passes/slips |
| `audit_events` | Auth phase | Security-relevant actions |

Phase 0 creates none of these. A table is added in the phase that uses it.

---

## 3. Proposed `schemes` structure (Phase 1 migration)

Documented here for review; **not yet written as SQL.**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `default gen_random_uuid()` |
| `slug` | `text` | **Unique**, stable, URL-safe public identifier |
| `official_name` | `text` | Exactly as the responsible department publishes it |
| `department` | `text` | The responsible department |
| `jurisdiction` | `text` | Constrained: `central` or `state` |
| `state_code` | `text` null | Required when `jurisdiction = 'state'`, null when `central` |
| `benefit_summary` | `text` | Plain-language summary |
| `eligibility_rules` | `jsonb` | Machine-readable rules consumed by the Python engine |
| `required_documents` | `jsonb` | Array of document identifiers |
| `official_apply_url` | `text` | Official application page |
| `source_url` | `text` | The page the facts were verified against |
| `review_status` | `text` | Constrained: `draft`, `needs_review`, `verified`, `rejected` |
| `verified_at` | `timestamptz` null | Set only when `review_status = 'verified'` |
| `rules_version` | `text` | Bumped whenever `eligibility_rules` changes, so a result is reproducible |
| `created_at` | `timestamptz` | `default now()` |
| `updated_at` | `timestamptz` | `default now()`, maintained by trigger |

**Constraints worth having, and no more**
- `unique (slug)`
- `check (jurisdiction in ('central','state'))`
- `check (review_status in ('draft','needs_review','verified','rejected'))`
- `check (jurisdiction = 'central' and state_code is null or jurisdiction = 'state' and state_code is not null)`
- `check (review_status <> 'verified' or verified_at is not null)` — a scheme cannot be verified without a date

**Indexes: only what a query needs**
- The `unique (slug)` index serves slug lookups.
- `index on (review_status, state_code)` for the list endpoint's filter.
- No full-text index until `q=` search exists and is slow. 500 MB does not reward speculative indexes.

### Row Level Security for `schemes`

```sql
alter table public.schemes enable row level security;

-- Anonymous and signed-in clients may read VERIFIED rows only.
create policy "verified schemes are publicly readable"
  on public.schemes for select
  to anon, authenticated
  using (review_status = 'verified');

-- No insert, update or delete policy for anon or authenticated.
-- Catalogue writes happen through a reviewed migration or a privileged backend task.
```

Draft and rejected rows stay invisible to browser clients. Writing no write-policy is the point:
with RLS enabled and no permissive policy, writes are denied by default.

---

## 4. Authentication and data isolation — the part that is easy to get wrong

Two different mechanisms, often confused:

| Mechanism | What it does | What it does **not** do |
|---|---|---|
| **FastAPI verifies a Supabase JWT** | Proves who the caller is, inside our Python code | Does **not** apply any database policy |
| **PostgreSQL RLS** | Filters rows based on the Postgres role and `auth.uid()` | Only applies to connections that do not bypass it |

**The trap:** our backend connects with a privileged Postgres role. Per Supabase's
documentation, the `service_role` has the `bypassrls` attribute, and on Supabase the `postgres`
role has it too. **A connection as `postgres` bypasses RLS entirely.** Writing an RLS policy and
then querying through that connection gives you no isolation whatsoever — the policy is simply
not consulted.

So: **RLS does not protect a connection that bypasses it.** Any claim that "RLS secures our user
data" is false while the backend uses a privileged connection.

### Required before the first private user table exists

Choose **one** approach explicitly and test it:

**Option A — authorisation in FastAPI (expected choice)**
Verify the Supabase JWT, extract the user id, and scope every query in Python
(`where user_id = :caller`). RLS stays enabled as defence in depth for any direct client access,
but it is not what protects the data. The protection is our own code, so it must be tested.

**Option B — delegate to RLS**
Connect as a non-privileged role and pass the user's JWT so `auth.uid()` resolves, or let the
browser talk to Supabase directly with the anon key. Then RLS is genuinely enforced, and we
cannot accidentally serve another user's rows.

**The isolation test is mandatory, not optional.** Before any private table ships, write an
integration test that proves:

1. User A creates a row.
2. User B's token cannot `SELECT` it.
3. User B's token cannot `UPDATE` or `DELETE` it.
4. A request with no token cannot read it.

A table holding one user's data does not ship until that test passes.

### Phase 0 position

No authentication, no user tables, no profile persistence. Eligibility in the first MVP is
**stateless**: computed from the request and not retained. We do not build profile persistence
on the grounds that it might be useful later.

---

## 5. Migrations

```
supabase/migrations/   ← the single source of truth, in Git
```

- Timestamped, forward-only SQL files: `20260101120000_create_schemes.sql`
- One logical change per file; never edit a migration that has been applied
- Policies ship **with** the table in the same migration, so a table is never briefly unprotected
- Seed data stays separate from schema (`supabase/seed.sql` when it exists)

**Nothing is applied to the remote project automatically.** No CI step and no application
start-up applies schema. Exact commands are in `../supabase/README.md`; applying them is a
deliberate human act after review.

SQLAlchemy models (Phase 1+) mirror what the migrations created. If a model and a migration
disagree, the migration is right.

---

## 6. Export and restore

Free tier gives no reliable backup, so this is our backup. Use a **direct** connection (port
5432) for dumps and restores — Supabase documents pooled connections as unsuitable for them.

```bash
# Schema only
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > backup/schema.sql
```

```bash
# Data only, catalogue tables
pg_dump --data-only --no-owner --table=public.schemes "$DATABASE_URL" > backup/schemes-data.sql
```

```bash
# Restore into a fresh project
psql "$DATABASE_URL" -f backup/schema.sql && psql "$DATABASE_URL" -f backup/schemes-data.sql
```

```bash
# Rebuild from Git instead of from a dump — the preferred path
supabase db push        # applies supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed.sql
```

Never commit a dump containing personal data. Catalogue data is public information and is safe
to commit; anything derived from a user is not.

---

## 7. Connection strings

Per Supabase's connection documentation:

| Method | Port | Use for |
|---|---|---|
| Direct | 5432 | A persistent server on an IPv6-capable network; **required** for `pg_dump`, restore and migrations |
| Shared pooler, session mode | 5432 | A persistent server on an IPv4-only network (Free tier has no IPv4 add-on) |
| Shared pooler, transaction mode | 6543 | Serverless/edge. No prepared statements; pool size 1 |

Formats (copy the exact host from Dashboard → *Connect*; the pooler host cannot be guessed):

```
Direct:              postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
Session pooler:      postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres
Transaction pooler:  postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:6543/postgres
```

**For this project:** FastAPI is a persistent server, so use the **direct** connection where the
network allows IPv6, otherwise the **session pooler**. Note that direct connections are IPv6-only
on Free; a developer on an IPv4-only network will see `unavailable` on a direct string and should
switch to the session pooler.

Percent-encode reserved characters (`&`, `#`, `?`, space) in the password. SQLAlchemy with
psycopg wants the `postgresql+psycopg://` prefix:

```
DATABASE_URL=postgresql+psycopg://postgres.[REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres
```

`DATABASE_URL` is a **secret**. Backend `.env` only — never `NEXT_PUBLIC_*`, never committed.
