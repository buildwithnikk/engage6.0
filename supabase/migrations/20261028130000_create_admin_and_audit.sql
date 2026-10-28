-- Phase 2: admin users, sessions and audit logging.
--
-- Portable PostgreSQL. Runs identically on local PostgreSQL 16 and on hosted
-- PostgreSQL (Supabase included).
--
-- Apply:    ./scripts/db.sh migrate
-- Rollback: ./scripts/db.sh rollback   (runs 20261028130000_create_admin_and_audit.down.sql)

begin;

-- 1. admin_users: local administrative accounts for catalogue curation.
create table if not exists public.admin_users (
    id            uuid primary key default gen_random_uuid(),
    email         text        not null,
    password_hash text        not null,
    role          text        not null,
    is_active     boolean     not null default true,
    last_login_at timestamptz null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    constraint admin_users_email_non_empty check (length(trim(email)) > 0),
    constraint admin_users_role_valid check (role in ('admin', 'reviewer', 'editor'))
);

create unique index if not exists admin_users_email_lower_idx
    on public.admin_users (lower(trim(email)));

comment on table public.admin_users is
    'Administrative users managing the scheme catalogue. Password hashes use Argon2.';

-- Trigger to maintain updated_at on admin_users
drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
    before update on public.admin_users
    for each row
    execute function public.set_updated_at();

-- 2. admin_sessions: short-lived, revocable sessions.
-- Never store raw session tokens; only SHA-256 hashes of tokens are stored.
create table if not exists public.admin_sessions (
    id              uuid primary key default gen_random_uuid(),
    admin_user_id   uuid        not null references public.admin_users(id) on delete cascade,
    token_hash      text        not null unique,
    csrf_token_hash text        not null,
    expires_at      timestamptz not null,
    revoked_at      timestamptz null,
    created_at      timestamptz not null default now()
);

create index if not exists admin_sessions_token_hash_idx
    on public.admin_sessions (token_hash);

create index if not exists admin_sessions_user_id_idx
    on public.admin_sessions (admin_user_id);

create index if not exists admin_sessions_expires_at_idx
    on public.admin_sessions (expires_at);

comment on table public.admin_sessions is
    'Revocable admin sessions. Raw tokens are delivered in HttpOnly cookies and never stored.';

-- 3. audit_events: append-only log of security and catalogue mutations.
-- Never logs passwords, session tokens, or personal answers.
create table if not exists public.audit_events (
    id             uuid primary key default gen_random_uuid(),
    actor_admin_id uuid        null references public.admin_users(id) on delete set null,
    action         text        not null,
    resource_type  text        not null,
    resource_id    uuid        null,
    metadata       jsonb       not null default '{}'::jsonb,
    created_at     timestamptz not null default now(),

    constraint audit_events_action_non_empty check (length(trim(action)) > 0),
    constraint audit_events_resource_type_non_empty check (length(trim(resource_type)) > 0),
    constraint audit_events_metadata_is_object check (coalesce(jsonb_typeof(metadata), '') = 'object')
);

create index if not exists audit_events_created_at_idx
    on public.audit_events (created_at desc);

create index if not exists audit_events_resource_idx
    on public.audit_events (resource_type, resource_id);

create index if not exists audit_events_actor_idx
    on public.audit_events (actor_admin_id);

comment on table public.audit_events is
    'Append-only security and catalogue mutation history. Contains no secrets or citizen data.';

-- Row Level Security: enabled with no permissive policies for anon/authenticated
-- so direct client access is rejected by default.
alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.audit_events enable row level security;

commit;
