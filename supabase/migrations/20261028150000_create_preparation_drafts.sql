-- Phase 4: Preparation Drafts for assisted application preparation.
--
-- Anonymous, visitor-scoped temporary drafts holding answers and document checklist
-- progress for a specific government scheme.
--
-- Apply:    ./scripts/db.sh migrate
-- Rollback: ./scripts/db.sh rollback

begin;

create table if not exists public.preparation_drafts (
    id                 uuid primary key default gen_random_uuid(),
    session_id         uuid not null references public.document_sessions(id) on delete cascade,
    scheme_id          uuid not null references public.schemes(id) on delete cascade,
    answers            jsonb not null default '{}'::jsonb,
    checklist_state    jsonb not null default '{}'::jsonb,
    expires_at         timestamptz not null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),

    constraint preparation_drafts_session_scheme_unique unique (session_id, scheme_id),
    constraint preparation_drafts_answers_is_object check (coalesce(jsonb_typeof(answers), '') = 'object'),
    constraint preparation_drafts_checklist_is_object check (coalesce(jsonb_typeof(checklist_state), '') = 'object')
);

create index if not exists preparation_drafts_session_idx on public.preparation_drafts(session_id);
create index if not exists preparation_drafts_scheme_idx on public.preparation_drafts(scheme_id);
create index if not exists preparation_drafts_expires_at_idx on public.preparation_drafts(expires_at);

drop trigger if exists set_preparation_drafts_updated_at on public.preparation_drafts;
create trigger set_preparation_drafts_updated_at
    before update on public.preparation_drafts
    for each row execute function public.set_updated_at();

alter table public.preparation_drafts enable row level security;

commit;
