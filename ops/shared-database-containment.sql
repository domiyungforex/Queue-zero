-- REVIEW REQUIRED: these tables belong to another application.
-- Apply only after confirming that it uses postgres/service_role (or another
-- BYPASSRLS backend role), not browser/mobile anon/authenticated table access.
-- Keep this out of QueueZero's automatic migrations. No row data is modified.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare table_name text; relation regclass;
begin
 foreach table_name in array array['Memory','Conversation','Permission','Agent','Wallet','Reputation','Message','SharedContext','ApiKey'] loop
  relation := to_regclass(format('public.%I',table_name));
  if relation is null then raise exception 'Expected shared table missing: %', table_name; end if;
  if exists(select 1 from pg_policy where polrelid=relation) then
   raise exception 'Existing policies require separate review: %', table_name;
  end if;
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all privileges on table public.%I from public, anon, authenticated',table_name);
  if has_table_privilege('anon',relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated',relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
   raise exception 'Inherited client privileges remain: %',table_name;
  end if;
 end loop;
end $$;
commit;
