-- Rollback Phase 3: document sessions, secure upload metadata, OCR extraction and extraction jobs.

begin;

drop trigger if exists document_jobs_set_updated_at on public.document_jobs;
drop trigger if exists documents_set_updated_at on public.documents;

drop table if exists public.document_jobs;
drop table if exists public.document_extractions;
drop table if exists public.documents;
drop table if exists public.document_sessions;

commit;
