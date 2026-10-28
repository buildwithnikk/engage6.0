-- Rollback Phase 5: Session preferences.

begin;

alter table public.document_sessions
    drop constraint if exists document_sessions_preferences_is_object;

alter table public.document_sessions
    drop column if exists preferences;

commit;
