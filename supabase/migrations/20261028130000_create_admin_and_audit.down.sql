-- Rollback Phase 2: admin users, sessions and audit logging.

begin;

drop trigger if exists admin_users_set_updated_at on public.admin_users;
drop table if exists public.audit_events;
drop table if exists public.admin_sessions;
drop table if exists public.admin_users;

commit;
