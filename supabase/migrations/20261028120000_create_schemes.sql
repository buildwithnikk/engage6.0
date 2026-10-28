-- Phase 1: the scheme catalogue.
--
-- Portable PostgreSQL. Runs identically on local PostgreSQL 16 and on hosted
-- PostgreSQL (Supabase included) — no extension beyond what core provides.
-- gen_random_uuid() is built into PostgreSQL 13+, so pgcrypto is not required.
--
-- Apply:    ./scripts/db.sh migrate
-- Rollback: ./scripts/db.sh rollback   (runs 20261028120000_create_schemes.down.sql)

begin;

create table if not exists public.schemes (
    id                 uuid primary key default gen_random_uuid(),
    slug               text        not null,
    official_name      text        not null,
    department         text        not null,
    jurisdiction       text        not null,
    state_code         text        null,
    benefit_summary    text        not null,
    eligibility_rules  jsonb       not null,
    required_documents jsonb       not null default '[]'::jsonb,
    official_apply_url text        null,
    source_url         text        not null,
    review_status      text        not null default 'draft',
    verified_at        timestamptz null,
    rules_version      text        not null default '1',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),

    -- A slug is a public identifier: stable, lowercase, URL-safe.
    constraint schemes_slug_unique unique (slug),
    constraint schemes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    constraint schemes_jurisdiction_valid
        check (jurisdiction in ('central', 'state')),

    -- A state scheme must name its state; a central scheme must not.
    constraint schemes_state_code_consistent check (
        (jurisdiction = 'central' and state_code is null)
        or (jurisdiction = 'state' and state_code is not null and state_code <> '')
    ),

    constraint schemes_review_status_valid
        check (review_status in ('draft', 'needs_review', 'verified', 'archived')),

    -- A record cannot claim verification without a date saying when.
    -- This is what stops a seed from quietly presenting invented data as checked.
    constraint schemes_verified_requires_date
        check (review_status <> 'verified' or verified_at is not null),

    -- Shape guards for the JSONB columns. The full rule schema is validated in
    -- Python (app/services/eligibility/rules.py); these catch the gross errors
    -- that would otherwise reach the evaluator as a surprise at read time.
    -- coalesce is load-bearing: `eligibility_rules -> 'all'` is SQL NULL when the
    -- key is absent, jsonb_typeof(NULL) is NULL, and `NULL = 'array'` is NULL —
    -- which a CHECK constraint accepts, because it only rejects FALSE. Without
    -- the coalesce, a rules document with no conditions at all passes.
    constraint schemes_eligibility_rules_is_object
        check (coalesce(jsonb_typeof(eligibility_rules), '') = 'object'),
    constraint schemes_eligibility_rules_has_conditions
        check (coalesce(jsonb_typeof(eligibility_rules -> 'all'), '') = 'array'),
    constraint schemes_required_documents_is_array
        check (coalesce(jsonb_typeof(required_documents), '') = 'array'),

    constraint schemes_source_url_present check (length(trim(source_url)) > 0)
);

comment on table public.schemes is
    'Government scheme catalogue. Only review_status = ''verified'' rows may be served publicly.';
comment on column public.schemes.eligibility_rules is
    'Rule document: {"version": "1", "all": [ ...conditions... ]}. See docs/eligibility-rules.md.';
comment on column public.schemes.rules_version is
    'Bumped whenever eligibility_rules changes, so a past result stays reproducible.';
comment on column public.schemes.review_status is
    'draft | needs_review | verified | archived. Public endpoints serve verified only.';

-- Indexes: the catalogue is small, so only what a real query uses.
-- The unique constraint on slug already provides the slug lookup index.

-- Every public list query filters on review_status first.
create index if not exists schemes_review_status_idx
    on public.schemes (review_status);

-- Jurisdiction/state filtering only ever happens over the public set, so the
-- partial index stays small and serves exactly that path.
create index if not exists schemes_public_filter_idx
    on public.schemes (jurisdiction, state_code)
    where review_status = 'verified';

-- Deliberately NO full-text index: text search is an ILIKE over a few hundred
-- rows. Add one when a measurement says it is slow, not before.

-- updated_at is maintained by the database, not the application. An application
-- that forgets is the normal failure; a trigger cannot forget, and it also covers
-- rows changed by a migration or by psql.
-- clock_timestamp(), not now(): now() returns the TRANSACTION start time, so two
-- updates inside one transaction would share an updated_at, and a row updated in
-- the same transaction that created it would show updated_at = created_at.
-- clock_timestamp() is the actual wall clock at write time, which is what this
-- column is supposed to mean.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = clock_timestamp();
    return new;
end;
$$;

drop trigger if exists schemes_set_updated_at on public.schemes;
create trigger schemes_set_updated_at
    before update on public.schemes
    for each row
    execute function public.set_updated_at();

commit;
