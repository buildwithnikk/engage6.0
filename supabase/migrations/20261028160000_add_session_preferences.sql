-- Phase 5: Visitor session preferences for locale and geographic discovery.
--
-- Adds preferences JSONB column to document_sessions to store language,
-- state_code, optional district, and rural/urban area selection.
--
-- Apply:    ./scripts/db.sh migrate
-- Rollback: ./scripts/db.sh rollback

begin;

alter table public.document_sessions
    add column if not exists preferences jsonb not null default '{}'::jsonb;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'document_sessions_preferences_is_object'
    ) then
        alter table public.document_sessions
            add constraint document_sessions_preferences_is_object
            check (coalesce(jsonb_typeof(preferences), '') = 'object');
    end if;
end $$;

commit;
