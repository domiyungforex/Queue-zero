begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(
  (select relrowsecurity from pg_class where oid = 'public."Conversation"'::regclass),
  'reported public Conversation table has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public."Conversation"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  'anonymous clients have no Conversation table privileges'
);
select ok(
  not has_table_privilege('authenticated', 'public."Conversation"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  'authenticated clients have no Conversation table privileges'
);
select is((select body from public."Conversation" where id = 1), 'shared fixture', 'RLS containment does not modify Conversation data');
set local role service_role;
select is((select count(*) from public."Conversation"), 1::bigint, 'service role retains backend access through BYPASSRLS');
reset role;

select * from finish();
rollback;
