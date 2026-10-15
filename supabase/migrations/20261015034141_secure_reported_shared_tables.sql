-- These mixed-case tables are owned by a separate backend workload but live in
-- Supabase's exposed public schema. They must never be reachable through the
-- anon/authenticated Data API roles. Existing rows and backend service-role
-- access are preserved.
do $$
declare
  table_name text;
  relation regclass;
begin
  foreach table_name in array array['Conversation', 'Permission', 'Agent', 'Wallet'] loop
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
