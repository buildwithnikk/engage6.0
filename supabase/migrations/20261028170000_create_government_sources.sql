-- Phase 6: Government Source Registry and Import Pipeline.
--
-- Registry of official government sources (portals, department sites)
-- and staged import candidates before admin review.
--
-- Apply:    ./scripts/db.sh migrate
-- Rollback: ./scripts/db.sh rollback

begin;

-- 1. government_sources: registered official portals and departments
create table if not exists public.government_sources (
    id              uuid primary key default gen_random_uuid(),
    name            text        not null,
    official_url    text        not null,
    source_type     text        not null default 'portal',
    jurisdiction    text        not null default 'central',
    state_code      text        null,
    last_checked_at timestamptz null,
    notes           text        null,
    is_active       boolean     not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint sources_jurisdiction_valid check (jurisdiction in ('central', 'state')),
    constraint sources_state_code_consistent check (
        (jurisdiction = 'central' and state_code is null)
        or (jurisdiction = 'state' and state_code is not null and state_code <> '')
    )
);

create index if not exists government_sources_active_idx on public.government_sources (is_active);
create index if not exists government_sources_jurisdiction_idx on public.government_sources (jurisdiction, state_code);

-- 2. import_candidates: raw and extracted structured data staged for review
create table if not exists public.import_candidates (
    id                  uuid primary key default gen_random_uuid(),
    source_id           uuid not null references public.government_sources(id) on delete cascade,
    source_url          text not null,
    external_reference  text null,
    extracted_data      jsonb not null,
    raw_payload         jsonb not null default '{}'::jsonb,
    status              text not null default 'pending',
    promoted_scheme_id  uuid null references public.schemes(id) on delete set null,
    review_notes        text null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    constraint import_candidates_status_valid check (status in ('pending', 'promoted', 'rejected')),
    constraint import_candidates_extracted_data_is_object check (coalesce(jsonb_typeof(extracted_data), '') = 'object')
);

create index if not exists import_candidates_source_idx on public.import_candidates (source_id);
create index if not exists import_candidates_status_idx on public.import_candidates (status);

-- Triggers for updated_at
drop trigger if exists set_government_sources_updated_at on public.government_sources;
create trigger set_government_sources_updated_at
    before update on public.government_sources
    for each row execute function public.set_updated_at();

drop trigger if exists set_import_candidates_updated_at on public.import_candidates;
create trigger set_import_candidates_updated_at
    before update on public.import_candidates
    for each row execute function public.set_updated_at();

alter table public.government_sources enable row level security;
alter table public.import_candidates enable row level security;

commit;
