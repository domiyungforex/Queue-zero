begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"authenticated","sub":"retry_owner"}',true);
select onboard_business('Retry clinic','healthcare','NG','Africa/Lagos','Main','Address');
select create_queue('ab000000-0000-4000-8000-000000000001',
 (select id from businesses where owner_user_id='retry_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='retry_owner'),
 'Consultation',null,300,3,false,false);
update queues set slug='retry-limit' where id='ab000000-0000-4000-8000-000000000001';
select join_public_queue('retry-limit','ab000000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64),'Ada',null);
do $$ begin
 for i in 1..59 loop
  perform join_public_queue('retry-limit',gen_random_uuid(),repeat('a',64),repeat('b',64),'Ada',null);
 end loop;
end $$;
select is((select count(*) from queue_join_requests where queue_id='ab000000-0000-4000-8000-000000000001'),60::bigint,'allows bounded new-tab recovery');
set local role service_role;
select throws_ok($$select join_public_queue('retry-limit',gen_random_uuid(),repeat('a',64),repeat('b',64),'Ada',null)$$,'QZ005',null,'active-ticket aliases cannot grow without bound');
select lives_ok($$select join_public_queue('retry-limit','ab000000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64),'Ada',null)$$,'exact request replay works even at limit');
select lives_ok($$select join_public_queue('retry-limit',gen_random_uuid(),repeat('c',64),repeat('b',64),'Ben',null)$$,'another customer on same network is unaffected');
reset role;
select is((select count(*) from tickets where queue_id='ab000000-0000-4000-8000-000000000001'),2::bigint,'aliases never allocate extra tickets');
update queue_join_requests set created_at=clock_timestamp()-interval '11 minutes' where customer_key=repeat('a',64) and queue_id='ab000000-0000-4000-8000-000000000001';
select lives_ok($$select join_public_queue('retry-limit',gen_random_uuid(),repeat('a',64),repeat('b',64),'Ada',null)$$,'new aliases allowed after the window');
select ok(not has_function_privilege('anon','private.bound_join_retry_records()','EXECUTE'),'anonymous users cannot invoke trigger helper');
select * from finish();
rollback;
