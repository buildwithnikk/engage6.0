-- Rollback Phase 4: Preparation Drafts.

begin;

drop trigger if exists set_preparation_drafts_updated_at on public.preparation_drafts;
drop table if exists public.preparation_drafts;

commit;
