-- Rollback for 20261028120000_create_schemes.sql
--
-- Drops the schemes table, its trigger and the trigger function. Destructive by
-- definition: everything in the catalogue goes with it. The catalogue is
-- reproducible from migrations plus seed, so this is safe in development; in a
-- deployed environment, export first (docs/database-schema.md section 6).

begin;

drop trigger if exists schemes_set_updated_at on public.schemes;
drop table if exists public.schemes;

-- Only drop the shared helper if nothing else still uses it.
do $$
begin
    if not exists (
        select 1
        from pg_trigger t
        join pg_proc p on p.oid = t.tgfoid
        where p.proname = 'set_updated_at'
          and not t.tgisinternal
    ) then
        drop function if exists public.set_updated_at();
    end if;
end
$$;

commit;
