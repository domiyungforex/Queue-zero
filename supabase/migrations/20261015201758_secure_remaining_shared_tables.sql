-- These tables belong to the separate backend workload sharing this Supabase
-- project. They are not part of TuRnMaRk's public Data API and must remain
-- accessible only through trusted backend credentials. Preserve all rows and
-- service-role access while closing anonymous and signed-in direct access.
do $$
declare
  table_name text;
  relation regclass;
begin
  foreach table_name in array array['Reputation', 'SharedContext', 'ApiKey'] loop
    relation := to_regclass(format('public.%I', table_name));
    if relation is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      table_name
    );
  end loop;
end;
$$;
