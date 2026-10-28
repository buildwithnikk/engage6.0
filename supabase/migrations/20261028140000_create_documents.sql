-- Phase 3: document sessions, secure upload metadata, OCR extraction and extraction jobs.
--
-- Portable PostgreSQL. Runs identically on local PostgreSQL 16 and on hosted
-- PostgreSQL (Supabase included).
--
-- Apply:    ./scripts/db.sh migrate
-- Rollback: ./scripts/db.sh rollback   (runs 20261028140000_create_documents.down.sql)

begin;

-- 1. document_sessions: anonymous visitor sessions for document upload & confirmation.
-- Separate from admin accounts. Stores only token hashes.
create table if not exists public.document_sessions (
    id              uuid primary key default gen_random_uuid(),
    token_hash      text        not null unique,
    csrf_token_hash text        not null,
    created_at      timestamptz not null default now(),
    expires_at      timestamptz not null
);

create index if not exists document_sessions_token_hash_idx
    on public.document_sessions (token_hash);

create index if not exists document_sessions_expires_at_idx
    on public.document_sessions (expires_at);

comment on table public.document_sessions is
    'Short-lived visitor sessions for local document extraction and eligibility confirmation.';

-- 2. documents: metadata for uploaded files stored in private local directory.
-- Raw file bytes are never stored in PostgreSQL.
create table if not exists public.documents (
    id                 uuid primary key default gen_random_uuid(),
    session_id         uuid        not null references public.document_sessions(id) on delete cascade,
    storage_key        text        not null unique,
    original_filename  text        null,
    media_type         text        not null,
    file_size          integer     not null,
    page_count         integer     not null default 1,
    status             text        not null default 'uploaded',
    confirmed_answers  jsonb       not null default '{}'::jsonb,
    expires_at         timestamptz not null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),

    constraint documents_media_type_valid
        check (media_type in ('application/pdf', 'image/jpeg', 'image/png')),
    constraint documents_status_valid
        check (status in ('uploaded', 'processing', 'extracted', 'failed')),
    constraint documents_file_size_positive
        check (file_size > 0 and file_size <= 10485760), -- max 10 MiB
    constraint documents_page_count_positive
        check (page_count >= 1 and page_count <= 10),    -- max 10 pages
    constraint documents_confirmed_answers_is_object
        check (coalesce(jsonb_typeof(confirmed_answers), '') = 'object')
);

create index if not exists documents_session_id_idx
    on public.documents (session_id);

create index if not exists documents_status_idx
    on public.documents (status);

create index if not exists documents_expires_at_idx
    on public.documents (expires_at);

comment on table public.documents is
    'Private document metadata. Actual files reside in configured private storage outside web root.';

-- Trigger to maintain updated_at on documents
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
    before update on public.documents
    for each row
    execute function public.set_updated_at();

-- 3. document_extractions: structured page-level text, parsed candidates, and warnings.
create table if not exists public.document_extractions (
    id                uuid primary key default gen_random_uuid(),
    document_id       uuid        not null references public.documents(id) on delete cascade,
    extractor_version text        not null,
    page_text         jsonb       not null default '[]'::jsonb,
    candidate_fields  jsonb       not null default '[]'::jsonb,
    warnings          jsonb       not null default '[]'::jsonb,
    created_at        timestamptz not null default now(),

    constraint document_extractions_page_text_is_array
        check (coalesce(jsonb_typeof(page_text), '') = 'array'),
    constraint document_extractions_candidate_fields_is_array
        check (coalesce(jsonb_typeof(candidate_fields), '') = 'array'),
    constraint document_extractions_warnings_is_array
        check (coalesce(jsonb_typeof(warnings), '') = 'array')
);

create index if not exists document_extractions_document_id_idx
    on public.document_extractions (document_id);

comment on table public.document_extractions is
    'Derived OCR and native text extraction outputs with page-level provenance.';

-- 4. document_jobs: PostgreSQL-backed local job queue with atomic leasing.
create table if not exists public.document_jobs (
    id           uuid primary key default gen_random_uuid(),
    document_id  uuid        not null references public.documents(id) on delete cascade,
    status       text        not null default 'queued',
    attempts     integer     not null default 0,
    leased_until timestamptz null,
    error_code   text        null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    constraint document_jobs_status_valid
        check (status in ('queued', 'processing', 'completed', 'failed', 'canceled'))
);

create index if not exists document_jobs_claim_idx
    on public.document_jobs (status, leased_until);

create index if not exists document_jobs_document_id_idx
    on public.document_jobs (document_id);

comment on table public.document_jobs is
    'Atomic background extraction tasks with lease timeout and bounded retries.';

-- Trigger to maintain updated_at on document_jobs
drop trigger if exists document_jobs_set_updated_at on public.document_jobs;
create trigger document_jobs_set_updated_at
    before update on public.document_jobs
    for each row
    execute function public.set_updated_at();

-- Row Level Security: enabled with no permissive public policies.
alter table public.document_sessions enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_jobs enable row level security;

commit;
