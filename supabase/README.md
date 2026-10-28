# Supabase

**`supabase/migrations/` is the single canonical migration history for this project.**

These migrations apply to **both** databases: local PostgreSQL in development and Supabase in
deployment. Development does not use Supabase at all — see `../docs/database-schema.md` §0.

```bash
# Locally
psql "postgresql://sahayak_app@127.0.0.1:5432/sahayak_dev" -f supabase/migrations/<file>.sql
```

SQLAlchemy models (Phase 1+) map a schema that migrations created. They never create a second
history, and Alembic is deliberately not introduced — two competing migration tools on one
database is how a schema becomes unreproducible.

**Phase 0 contains no migrations.** The directory is empty on purpose. The first migration
(`schemes` plus its RLS policy) is written in Phase 1, after the connection approach is verified.

## Rules

1. **Nothing is applied automatically.** No CI job and no application start-up runs a migration.
   Applying schema to the remote project is a deliberate human act, after review.
2. **Forward-only, timestamped files:** `20260101120000_create_schemes.sql`.
3. **Never edit an applied migration.** Write a new one.
4. **Ship a table's RLS policy in the same migration as the table**, so it is never briefly
   unprotected.
5. **Keep schema and seed separate.** Schema in `migrations/`, seed data in `seed.sql`.
6. **Never commit a dump containing personal data.** Catalogue data is public information and is
   safe; anything derived from a user is not.

## Connecting

Get the exact connection string from Dashboard → **Connect** (the pooler host cannot be guessed
from the region). Use the **direct** connection on an IPv6-capable network, or the **session
pooler** on IPv4-only. Full detail, including the `+psycopg` prefix the backend needs, is in
`../docs/database-schema.md` §7.

## Applying migrations

With the Supabase CLI (install: https://supabase.com/docs/guides/local-development):

```bash
supabase link --project-ref <PROJECT-REF>
```

```bash
# Review first — this prints what WOULD change, and applies nothing
supabase db diff --linked
```

```bash
# Apply the reviewed migrations to the linked project
supabase db push
```

Or with plain `psql`, using a direct connection:

```bash
psql "$DATABASE_URL" -f supabase/migrations/<timestamp>_<name>.sql
```

## Seeding

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

`seed.sql` does not exist yet; it arrives with the Phase 1 catalogue. Seed data is synthetic or
public information only — never a real citizen's data.

## Export and restore

Free tier has **no reliable backup** (no Point-in-Time Recovery), so these exports are the
backup. Use a direct connection; pooled connections are documented as unsuitable for dumps.

```bash
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > backup/schema.sql
pg_dump --data-only --no-owner --table=public.schemes "$DATABASE_URL" > backup/schemes-data.sql
```

```bash
psql "$DATABASE_URL" -f backup/schema.sql
psql "$DATABASE_URL" -f backup/schemes-data.sql
```

Preferred recovery path is to rebuild from Git rather than from a dump:

```bash
supabase db push && psql "$DATABASE_URL" -f supabase/seed.sql
```

`backup/` is git-ignored.

## Free tier, in short

500 MB database · 1 GB storage · 5 GB egress · 50,000 MAU · 2 active free projects ·
paused after ~7 days of low activity, restorable within 1 year · no PITR.

**We do not generate artificial keep-alive traffic to avoid pausing.** Resuming is one click in
the Dashboard, and the schema plus seed can rebuild the database from Git.
