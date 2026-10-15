begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(relrowsecurity and relforcerowsecurity, 'reported public ' || relname || ' table has forced RLS enabled')
from pg_class
where oid in (
  'public."Conversation"'::regclass,
  'public."Permission"'::regclass,
  'public."Agent"'::regclass,
  'public."Wallet"'::regclass
)
order by relname;

select ok(
  not has_table_privilege('anon', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  'anonymous clients have no ' || relname || ' table privileges'
)
from pg_class
where oid in (
  'public."Conversation"'::regclass,
  'public."Permission"'::regclass,
  'public."Agent"'::regclass,
  'public."Wallet"'::regclass
)
order by relname;

select ok(
  not has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  'authenticated clients have no ' || relname || ' table privileges'
)
from pg_class
where oid in (
  'public."Conversation"'::regclass,
  'public."Permission"'::regclass,
  'public."Agent"'::regclass,
  'public."Wallet"'::regclass
)
order by relname;

select is((select body from public."Conversation" where id = 1), 'shared fixture', 'Conversation data is preserved');
select is((select body from public."Permission" where id = 1), 'shared fixture', 'Permission data is preserved');
select is((select body from public."Agent" where id = 1), 'shared fixture', 'Agent data is preserved');
select is((select body from public."Wallet" where id = 1), 'shared fixture', 'Wallet data is preserved');

set local role service_role;
select is((select count(*) from public."Conversation"), 1::bigint, 'service role retains Conversation access');
select is((select count(*) from public."Permission"), 1::bigint, 'service role retains Permission access');
select is((select count(*) from public."Agent"), 1::bigint, 'service role retains Agent access');
select is((select count(*) from public."Wallet"), 1::bigint, 'service role retains Wallet access');
reset role;

select * from finish();
rollback;
