begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"authenticated","sub":"join_owner"}',true);
select onboard_business('Join clinic','healthcare','GH','Pacific/Kiritimati','Main','Address');
select create_queue('50000000-0000-4000-8000-000000000001',
 (select id from businesses where owner_user_id='join_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='join_owner'),
 'Consultation',null,300,3,true,false);
update queues set slug='join-test' where id='50000000-0000-4000-8000-000000000001';
select ok(not has_function_privilege('anon','join_public_queue(text,uuid,text,text,text,text)','EXECUTE'),'direct anonymous mutation denied');
select ok(not has_function_privilege('authenticated','join_public_queue(text,uuid,text,text,text,text)','EXECUTE'),'authenticated users cannot supply trusted join keys');
select ok(has_function_privilege('service_role','join_public_queue(text,uuid,text,text,text,text)','EXECUTE'),'server may join');
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in ('queue_join_requests'::regclass,'queue_join_rate_limits'::regclass)),'new private tables force RLS');
set local role service_role;
select lives_ok($$select join_public_queue('join-test','51000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),' Ada ','+233 (24) 123-4567')$$,'join works through server role');
reset role;
select is((select display_number from tickets where customer_key=repeat('a',64)),'A001','first daily number');
select is((select customer_name from tickets where customer_key=repeat('a',64)),'Ada','trimmed name');
select is((select phone from tickets where customer_key=repeat('a',64)),'+233241234567','normalized phone');
select is((select service_date from tickets where customer_key=repeat('a',64)),(clock_timestamp() at time zone 'Pacific/Kiritimati')::date,'location date used');
select is((select estimated_wait_seconds from tickets where customer_key=repeat('a',64)),0,'empty initial estimate');
select is((select count(*) from ticket_events where queue_id='50000000-0000-4000-8000-000000000001' and type='joined' and actor_type='customer'),1::bigint,'audited customer join');
select is(join_public_queue('join-test','51000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'Ada',null),
 (select public_token from tickets where customer_key=repeat('a',64)),'same request retries original ticket');
select is(join_public_queue('join-test','51000000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64),'Ada',null),
 (select public_token from tickets where customer_key=repeat('a',64)),'second tab resumes active ticket');
select is((select last_number from queue_daily_counters where queue_id='50000000-0000-4000-8000-000000000001'),1,'retries do not consume numbers');
select is((select joins from queue_join_rate_limits where key=repeat('b',64)),1,'retries do not consume rate budget');
select throws_ok($$select join_public_queue('join-test','51000000-0000-4000-8000-000000000001',repeat('c',64),repeat('b',64),'Eve',null)$$,'QZ006',null,'request cannot be claimed by another session');
update tickets set status='completed',called_at=clock_timestamp(),completed_at=clock_timestamp() where customer_key=repeat('a',64);
select is(join_public_queue('join-test','51000000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64),'Ada',null),
 (select public_token from tickets where customer_key=repeat('a',64)),'alias retry after completion still returns original');
select lives_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('a',64),repeat('b',64),'Ada',null)$$,'new request after completion may join again');
update queues set status='paused' where slug='join-test';
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('c',64),repeat('b',64),'Ben',null)$$,'QZ002',null,'paused queue rejects new customer');
select lives_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('a',64),repeat('b',64),'Ada',null)$$,'paused queue can still recover existing place');
update queues set status='open', require_phone=true where slug='join-test';
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('c',64),repeat('b',64),'Ben',null)$$,'QZ003',null,'current required phone rule enforced');
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('c',64),repeat('b',64),'Ben','123')$$,'QZ003',null,'invalid international phone rejected');
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('c',64),repeat('b',64),'   ','+233241234567')$$,'22023',null,'empty name rejected');
select is((select last_number from queue_daily_counters where queue_id='50000000-0000-4000-8000-000000000001'),2,'invalid submissions consume no numbers');
update queues set require_phone=false,allow_phone=false where slug='join-test';
select lives_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('c',64),repeat('b',64),'Ben','DO NOT STORE')$$,'disabled phone discarded');
select is((select phone from tickets where customer_key=repeat('c',64)),null::text,'disabled phone never saved');
select is((select estimated_wait_seconds from tickets where customer_key=repeat('c',64)),300,'estimate counts waiting tickets only');
update queue_daily_counters set last_number=999 where queue_id='50000000-0000-4000-8000-000000000001';
select lives_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('d',64),repeat('b',64),'Dee',null)$$,'four digit allocation');
select is((select display_number from tickets where customer_key=repeat('d',64)),'A1000','display number is not truncated');
update queue_join_rate_limits set joins=59 where key=repeat('b',64);
select lives_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('e',64),repeat('b',64),'Eli',null)$$,'60th network join allowed');
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('f',64),repeat('b',64),'Fran',null)$$,'QZ005',null,'61st network join rejected');
select is((select joins from queue_join_rate_limits where key=repeat('b',64)),60,'rejected increment rolled back');
select is((select last_number from queue_daily_counters where queue_id='50000000-0000-4000-8000-000000000001'),1001,'rate rejection consumes no number');
update queue_join_rate_limits set window_started_at=now()-interval '11 minutes' where key=repeat('b',64);
select lives_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('f',64),repeat('b',64),'Fran',null)$$,'expired rate window resets');
select is((select joins from queue_join_rate_limits where key=repeat('b',64)),1,'new window starts at one');
select set_config('test.receipt_token',(select public_token::text from tickets where customer_key=repeat('c',64)),true);
set local role anon;
select is((select count(*) from get_public_join_options('join-test')),1::bigint,'anonymous join options available');
select is((select string_agg(key,',' order by key) from jsonb_object_keys((select to_jsonb(r) from get_public_ticket_receipt(current_setting('test.receipt_token')::uuid) r)) keys(key)),
 'business_name,display_number,queue_name,status','receipt has only intentional public fields');
select is((select count(*) from get_public_ticket_receipt(gen_random_uuid())),0::bigint,'unknown token returns nothing');
select throws_ok('select * from queue_join_requests','42501',null,'request mappings private');
select throws_ok('select * from queue_join_rate_limits','42501',null,'rate keys private');
select throws_ok('select * from tickets','42501',null,'tickets remain private');
reset role;
-- A failure after ticket allocation must roll back ticket, counter, rate and event.
create function pg_temp.fail_join_event() returns trigger language plpgsql as $$begin raise exception 'injected event failure'; end$$;
create trigger fail_join before insert on ticket_events for each row execute function pg_temp.fail_join_event();
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('1',64),repeat('b',64),'Fail',null)$$,'P0001','injected event failure','event failure aborts transaction');
select is((select last_number from queue_daily_counters where queue_id='50000000-0000-4000-8000-000000000001'),1002,'counter rollback after downstream failure');
select is((select count(*) from tickets where customer_key=repeat('1',64)),0::bigint,'ticket rollback after downstream failure');
select is((select joins from queue_join_rate_limits where key=repeat('b',64)),1,'rate budget rollback after downstream failure');
drop trigger fail_join on ticket_events;
-- Fill the active queue to its enforced safety limit using a separate service date.
insert into tickets(queue_id,service_date,sequence_number,display_number,customer_name)
 select '50000000-0000-4000-8000-000000000001',current_date-10,n,'A'||lpad(n::text,3,'0'),'Existing'
 from generate_series(1,1000-(select count(*)::integer from tickets where queue_id='50000000-0000-4000-8000-000000000001' and status in ('waiting','serving'))) n;
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('1',64),repeat('b',64),'New',null)$$,'QZ004',null,'full queue rejects joins across service dates');
select is((select last_number from queue_daily_counters where queue_id='50000000-0000-4000-8000-000000000001'),1002,'capacity rejection does not allocate a number');
update locations set is_active=false where business_id=(select id from businesses where owner_user_id='join_owner');
select throws_ok($$select join_public_queue('join-test',gen_random_uuid(),repeat('1',64),repeat('b',64),'New',null)$$,'QZ001',null,'inactive location rejects join');
select * from finish();
rollback;
