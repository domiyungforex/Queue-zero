begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"authenticated","sub":"wait_engine_owner"}',true);
select onboard_business('Wait clinic','healthcare','GH','UTC','Main','Address');
select create_queue('b0000000-0000-4000-8000-000000000001',
 (select id from businesses where owner_user_id='wait_engine_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='wait_engine_owner'),
 'Consultation',null,300,3,false,false);
update queues set slug='wait-engine-test' where id='b0000000-0000-4000-8000-000000000001';
select ok(not has_function_privilege('anon','private.queue_service_seconds(uuid)','EXECUTE'),'anonymous users cannot query internal queue IDs/history');
select ok(not has_function_privilege('authenticated','private.queue_service_seconds(uuid)','EXECUTE'),'internal aggregate has no direct tenant-ID bypass');
select ok(not has_function_privilege('service_role','private.queue_service_seconds(uuid)','EXECUTE'),'helper only used through deliberate definer functions');
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),300,'empty recently opened queue uses configured default');
select is(private.queue_service_seconds(gen_random_uuid()),null::integer,'unknown queue has no service estimate');
select join_public_queue('wait-engine-test',gen_random_uuid(),repeat('a',64),repeat('e',64),'One',null);
select join_public_queue('wait-engine-test',gen_random_uuid(),repeat('b',64),repeat('e',64),'Two',null);
select join_public_queue('wait-engine-test',gen_random_uuid(),repeat('c',64),repeat('e',64),'Three',null);
select is((select estimated_wait_seconds from tickets where customer_key=repeat('c',64) and queue_id='b0000000-0000-4000-8000-000000000001'),600,'new ticket uses configured fallback');
insert into tickets(id,queue_id,service_date,sequence_number,display_number,customer_name,status,joined_at,called_at,completed_at)
 select ('b1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b0000000-0000-4000-8000-000000000001',current_date-1,n,'A'||lpad(n::text,3,'0'),'PRIVATE_HISTORY','completed',
 now()-interval '2 days',now()-interval '1 day'+n*interval '20 minutes',now()-interval '1 day'+n*interval '20 minutes'+interval '10 minutes'
 from generate_series(1,4) n;
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),300,'four observations retain the configured default');
insert into tickets(id,queue_id,service_date,sequence_number,display_number,customer_name,status,joined_at,called_at,completed_at)
 values('b1000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001',current_date-1,5,'A005','PRIVATE_HISTORY','completed',now()-interval '2 days',now()-interval '1 day'+interval '100 minutes',now()-interval '1 day'+interval '110 minutes');
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),529,'five 600s services give the shared 529s EWMA golden value');
select set_config('test.wait_token',(select public_token::text from tickets where customer_key=repeat('c',64) and queue_id='b0000000-0000-4000-8000-000000000001'),true);
set local role anon;
select is((select estimated_wait_seconds from get_public_queue('wait-engine-test')),1587::bigint,'landing uses historical service estimate');
select is((select estimated_wait_seconds from get_public_ticket(current_setting('test.wait_token')::uuid)),1058::bigint,'ticket uses the same historical average with its current position');
select is((select people_ahead from get_public_ticket(current_setting('test.wait_token')::uuid)),2::bigint,'completed history does not count as people ahead');
reset role;
select join_public_queue('wait-engine-test',gen_random_uuid(),repeat('d',64),repeat('e',64),'Four',null);
select is((select estimated_wait_seconds from tickets where customer_key=repeat('d',64) and queue_id='b0000000-0000-4000-8000-000000000001'),1587,'atomic join stores the same historical estimate');
select is((select average_service_seconds from queues where slug='wait-engine-test'),300,'learned estimates never overwrite manager configuration');
select is((select revision from queues where slug='wait-engine-test'),2,'reads and joins do not mutate queue revisions');
update queues set status='paused' where slug='wait-engine-test';
select is((select estimated_wait_seconds from get_public_ticket(current_setting('test.wait_token')::uuid)),null::bigint,'historical estimates remain suppressed while paused');
update queues set status='open' where slug='wait-engine-test';
-- Newest twenty supersede the earlier history, including long prior samples.
insert into tickets(id,queue_id,service_date,sequence_number,display_number,customer_name,status,joined_at,called_at,completed_at)
 select ('b1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b0000000-0000-4000-8000-000000000001',current_date-1,n,'A'||lpad(n::text,3,'0'),'PRIVATE_RECENT','completed',
 now()-interval '2 days',now()-interval '5 hours'+n*interval '2 minutes',now()-interval '5 hours'+n*interval '2 minutes'+interval '1 minute'
 from generate_series(6,25) n;
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),61,'only newest twenty contribute: shared 61s EWMA golden value');
select is((select estimated_wait_seconds from get_public_ticket(current_setting('test.wait_token')::uuid)),122::bigint,'ticket reflects recent shorter services');
-- Zero-length history is not useful evidence and must not evict valid samples.
insert into tickets(queue_id,service_date,sequence_number,display_number,customer_name,status,joined_at,called_at,completed_at)
 values('b0000000-0000-4000-8000-000000000001',current_date-1,26,'A026','Zero','completed',now()-interval '1 hour',now(),now());
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),61,'zero service durations are excluded before limiting history');
-- Deliberately stale open tickets cannot cause integer overflow in stored waits.
update tickets set called_at=now()-interval '10 days',joined_at=now()-interval '11 days',completed_at=now()-interval '1 day'+sequence_number*interval '1 minute'
 where queue_id='b0000000-0000-4000-8000-000000000001' and status='completed';
select cmp_ok(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),'<=',86400,'very long measurements are bounded to 24 hours');
select cmp_ok(private.queue_service_seconds('b0000000-0000-4000-8000-000000000001'),'>',80000,'long measurements still materially inform the estimate');
select ok((select to_jsonb(q)::text !~ 'PRIVATE_|b1000000|customer_key' from get_public_queue('wait-engine-test') q),'history never appears in public response');
-- Distinct durations sharing a completion time must use deterministic UUID order.
select create_queue('b0000000-0000-4000-8000-000000000002',
 (select id from businesses where owner_user_id='wait_engine_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='wait_engine_owner'),
 'Second queue',null,300,3,false,false);
insert into tickets(id,queue_id,service_date,sequence_number,display_number,customer_name,status,joined_at,called_at,completed_at)
 select ('b2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b0000000-0000-4000-8000-000000000002',current_date,n,'A'||lpad(n::text,3,'0'),'Tie sample','completed',
 now()-interval '1 day',now()-n*interval '1 minute',now()
 from generate_series(5,1,-1) n;
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000002'),234,'varied equal-time durations match the TypeScript UUID ordering golden value');
-- Reverse completion ordering within a millisecond; timestamps take precedence.
update tickets set completed_at=completed_at+(6-sequence_number)*interval '1 microsecond',
 called_at=called_at+(6-sequence_number)*interval '1 microsecond'
 where queue_id='b0000000-0000-4000-8000-000000000002';
select is(private.queue_service_seconds('b0000000-0000-4000-8000-000000000002'),184,'microsecond completion ordering takes precedence over UUID order');
select * from finish();
rollback;
