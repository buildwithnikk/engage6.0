-- Rollback Phase 6: Government Source Registry and Import Pipeline.

begin;

drop trigger if exists set_import_candidates_updated_at on public.import_candidates;
drop trigger if exists set_government_sources_updated_at on public.government_sources;

drop table if exists public.import_candidates;
drop table if exists public.government_sources;

commit;
