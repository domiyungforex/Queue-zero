begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"public_queue_owner_a"}', true);
select onboard_business('Public Clinic A', 'healthcare', 'GH', 'Africa/Accra', 'Main Branch', 'Private address');
select create_queue('40000000-0000-4000-8000-000000000001',
  (select id from businesses where owner_user_id='public_queue_owner_a'),
  (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='public_queue_owner_a'),
  'Consultation', 'Public description', 300, 3, true, false);
update queues set slug='public-service-a' where id='40000000-0000-4000-8000-000000000001';
update businesses set logo_url='https://example.com/clinic.png' where owner_user_id='public_queue_owner_a';
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"public_queue_owner_b"}', true);
select onboard_business('Public Clinic B', 'healthcare', 'GH', 'Africa/Accra', 'Other Branch', 'Other private address');
select create_queue('40000000-0000-4000-8000-000000000002',
  (select id from businesses where owner_user_id='public_queue_owner_b'),
  (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='public_queue_owner_b'),
  'Haircut', null, 600, 3, false, false);
update queues set slug='public-service-b' where id='40000000-0000-4000-8000-000000000002';

insert into tickets(queue_id,service_date,sequence_number,display_number,customer_name,phone,status,joined_at,called_at,completed_at,cancelled_at,no_show_at) values
 ('40000000-0000-4000-8000-000000000001',current_date-1,1,'A001','PRIVATE_YESTERDAY','+233555000001','waiting',now()-interval '1 day',null,null,null,null),
 ('40000000-0000-4000-8000-000000000001',current_date,1,'A001','PRIVATE_WAITING','+233555000002','waiting',now(),null,null,null,null),
 ('40000000-0000-4000-8000-000000000001',current_date,2,'A002','PRIVATE_SERVING','+233555000003','serving',now(),now(),null,null,null),
 ('40000000-0000-4000-8000-000000000001',current_date,3,'A003','PRIVATE_COMPLETED',null,'completed',now(),now(),now(),null,null),
 ('40000000-0000-4000-8000-000000000001',current_date,4,'A004','PRIVATE_CANCELLED',null,'cancelled',now(),null,null,now(),null),
 ('40000000-0000-4000-8000-000000000001',current_date,5,'A005','PRIVATE_NO_SHOW',null,'no_show',now(),null,null,null,now());

select ok(has_function_privilege('anon','public.get_public_queue(text)','EXECUTE'),'anonymous callers may read the deliberate public projection');
select ok(has_function_privilege('authenticated','public.get_public_queue(text)','EXECUTE'),'signed-in users may also view public queues');
select ok(not has_function_privilege('service_role','public.get_public_queue(text)','EXECUTE'),'public page does not require the service role');
select is((select prosecdef from pg_proc where oid='public.get_public_queue(text)'::regprocedure),true,'projection has a controlled definer boundary');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid='public.get_public_queue(text)'::regprocedure),'projection has an empty fixed search path');

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from get_public_queue('public-service-a')),1::bigint,'one exact slug returns one queue without a user');
select is((select business_name from get_public_queue('public-service-a')),'Public Clinic A','public business name returned');
select is((select business_logo_url from get_public_queue('public-service-a')),'https://example.com/clinic.png','public logo returned');
select is((select queue_name from get_public_queue('public-service-a')),'Consultation','public service name returned');
select is((select location_name from get_public_queue('public-service-a')),'Main Branch','public branch name returned without private address');
select is((select description from get_public_queue('public-service-a')),'Public description','description returned');
select is((select waiting_count from get_public_queue('public-service-a')),2::bigint,'only waiting tickets counted, including previous service dates');
select is((select estimated_wait_seconds from get_public_queue('public-service-a')),600::bigint,'initial estimate uses waiting count and configured service duration');
select is((select has_serving_customer from get_public_queue('public-service-a')),true,'serving is exposed only as a boolean');
select is((select waiting_count from get_public_queue('public-service-b')),0::bigint,'another queue has its own count');
select is((select estimated_wait_seconds from get_public_queue('public-service-b')),0::bigint,'empty queue has zero calculated wait');
select is((select has_serving_customer from get_public_queue('public-service-b')),false,'empty queue has no serving customer');
select is((select description from get_public_queue('public-service-b')),null::text,'optional description may be absent');
select is((select string_agg(key,',' order by key) from jsonb_object_keys((select to_jsonb(q) from get_public_queue('public-service-a') q)) as keys(key)),
 'business_logo_url,business_name,description,estimated_wait_seconds,has_serving_customer,location_name,queue_name,slug,status,waiting_count', 'public contract contains no IDs, customer fields, ownership, phone settings or private analytics');
select ok((select to_jsonb(q)::text !~ 'PRIVATE_|233555|40000000|owner_user|subscription' from get_public_queue('public-service-a') q),'serialized public response contains no fixture secrets');
select throws_ok('select * from tickets','42501',null,'anonymous caller still cannot read tickets');
select throws_ok('select * from queues','42501',null,'anonymous caller still cannot read raw queues');
select throws_ok('select * from businesses','42501',null,'anonymous caller still cannot read raw business data');
select throws_ok('update queues set status=''closed''','42501',null,'public read does not grant mutations');
select is((select count(*) from get_public_queue('not-found')),0::bigint,'unknown slug returns nothing');
select is((select count(*) from get_public_queue(null)),0::bigint,'null slug returns nothing');
select is((select count(*) from get_public_queue('%')),0::bigint,'wildcards cannot enumerate queues');
select is((select count(*) from get_public_queue('public-service-a'' OR true --')),0::bigint,'SQL-looking input does not alter the query');
select is((select count(*) from get_public_queue(repeat('x',101))),0::bigint,'oversized slug returns nothing');
select is((select count(*) from get_public_queue('PUBLIC-SERVICE-A')),0::bigint,'noncanonical slug returns nothing');

reset role;
update queues set status='paused' where slug='public-service-a';
set local role anon;
select is((select status::text from get_public_queue('public-service-a')),'paused','paused state is public');
select is((select waiting_count from get_public_queue('public-service-a')),2::bigint,'paused state retains actual waiting count');
select is((select estimated_wait_seconds from get_public_queue('public-service-a')),null::bigint,'paused queue does not promise an active wait estimate');
reset role;
update queues set status='closed' where slug='public-service-a';
set local role anon;
select is((select status::text from get_public_queue('public-service-a')),'closed','closed queue remains a recognizable landing page');
select is((select estimated_wait_seconds from get_public_queue('public-service-a')),null::bigint,'closed queue has no active wait estimate');
reset role;
update locations set is_active=false where business_id=(select id from businesses where owner_user_id='public_queue_owner_a');
set local role anon;
select is((select count(*) from get_public_queue('public-service-a')),0::bigint,'inactive locations are unavailable publicly');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"unrelated_user"}',true);
select is((select business_name from get_public_queue('public-service-b')),'Public Clinic B','public viewing does not require business membership');
select is((select count(*) from queues),0::bigint,'public viewing does not expand signed-in tenant access');
reset role;
set constraints all immediate;
select * from finish();
rollback;
