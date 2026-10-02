begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_owner"}',true);
select onboard_business('Call clinic','healthcare','GH','UTC','Main','Address');
select create_queue('d0000000-0000-4000-8000-000000000001',
 (select id from businesses where owner_user_id='call_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='call_owner'),
 'Consultation',null,300,3,false,false);
update queues set slug='call-test' where id='d0000000-0000-4000-8000-000000000001';
insert into business_members(id,business_id,clerk_user_id,role)
 select ('d1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,b.id,
 case n when 1 then 'call_admin' when 2 then 'call_staff' else 'call_unassigned' end,
 case when n=1 then 'admin'::business_role else 'staff'::business_role end
 from businesses b cross join generate_series(1,3) n where b.owner_user_id='call_owner';
insert into queue_staff_assignments(business_id,queue_id,business_member_id)
 select id,'d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002' from businesses where owner_user_id='call_owner';
insert into tickets(id,queue_id,public_token,service_date,sequence_number,display_number,customer_name,joined_at) values
 ('d2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',current_date-1,99,'A099','Yesterday',now()-interval '1 day'),
 ('d2000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002',current_date,1,'A001','First today',now()-interval '10 minutes'),
 ('d2000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003',current_date,2,'A002','Second today',now()-interval '10 minutes');
insert into tickets(queue_id,service_date,sequence_number,display_number,customer_name,status,joined_at,cancelled_at,no_show_at) values
 ('d0000000-0000-4000-8000-000000000001',current_date-2,1,'A001','Cancelled earlier','cancelled',now()-interval '2 days',now(),null),
 ('d0000000-0000-4000-8000-000000000001',current_date-2,2,'A002','No-show earlier','no_show',now()-interval '2 days',null,now());
select set_config('request.jwt.claims','{"role":"authenticated","sub":"another_business_user"}',true);
select onboard_business('Other clinic','healthcare','GH','UTC','Other branch','Other address');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_owner"}',true);
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='queue_call_requests'::regclass),'request records force RLS');
select ok(not has_function_privilege('anon','call_next_ticket(uuid,uuid)','EXECUTE'),'anonymous mutation denied');
select ok(not has_function_privilege('service_role','call_next_ticket(uuid,uuid)','EXECUTE'),'service-role bypass not used for staff operations');
select ok(has_function_privilege('authenticated','call_next_ticket(uuid,uuid)','EXECUTE'),'authenticated execution available with internal authorization');
set local role authenticated;
select throws_ok('select * from queue_call_requests','42501',null,'raw action history is private');
select throws_ok($$select * from call_next_ticket(null,gen_random_uuid())$$,'22023',null,'null queue rejected');
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',null)$$,'22023',null,'null request nonce rejected');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_unassigned"}',true);
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'42501',null,'unassigned staff cannot operate');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"another_business_user"}',true);
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'42501',null,'foreign user cannot operate');
select throws_ok('select * from call_next_ticket(gen_random_uuid(),gen_random_uuid())','42501',null,'unknown queue is indistinguishable from unauthorized queue');
select set_config('request.jwt.claims','{"role":"anon","sub":"call_owner"}',true);
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'42501',null,'unverified actor claim rejected');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_owner"}',true);
select is((select outcome from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')),'called','owner can call next');
reset role;
select is((select status::text from tickets where id='d2000000-0000-4000-8000-000000000001'),'serving','oldest waiting customer across midnight called first');
select ok((select called_at>=joined_at from tickets where id='d2000000-0000-4000-8000-000000000001'),'call time recorded');
select is((select estimated_wait_seconds from tickets where id='d2000000-0000-4000-8000-000000000001'),0,'serving ticket no longer has stored waiting estimate');
select is((select count(*) from ticket_events where ticket_id='d2000000-0000-4000-8000-000000000001' and type='called' and actor_type='staff' and actor_id='call_owner'),1::bigint,'one staff audit event recorded');
select is((select metadata->>'request_id' from ticket_events where ticket_id='d2000000-0000-4000-8000-000000000001' and type='called'),'d4000000-0000-4000-8000-000000000001','audit links stable request ID');
select is((select revision from queues where slug='call-test'),2,'calling does not invalidate manager configuration revisions');
set local role anon;
select is((select people_ahead from get_public_ticket('d3000000-0000-4000-8000-000000000002')),0::bigint,'next customer position recalculates from authoritative state');
select is((select waiting_count from get_public_queue('call-test')),2::bigint,'public queue count reflects call');
reset role;
set local role authenticated;
select is((select replayed from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')),true,'same nonce replays original call');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_admin"}',true);
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')$$,'42501',null,'another actor cannot claim an existing nonce');
select is((select outcome from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002')),'already_serving','admin call does not auto-complete existing service');
reset role;
select is((select count(*) from ticket_events where queue_id='d0000000-0000-4000-8000-000000000001' and type='called'),1::bigint,'busy request creates no extra call event');
update tickets set status='completed',completed_at=clock_timestamp() where id='d2000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_owner"}',true);
select is((select ticket_id from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')),'d2000000-0000-4000-8000-000000000001'::uuid,'retry after completion returns original ticket, never the next');
select is((select ticket_status::text from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')),'completed','replay reflects original ticket current status');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_admin"}',true);
select is((select replayed from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002')),true,'busy request remains an idempotent recorded outcome after completion');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"call_staff"}',true);
select is((select ticket_id from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000003')),'d2000000-0000-4000-8000-000000000002'::uuid,'assigned staff can call; UUID resolves joined-time tie');
reset role;
update tickets set status='completed',completed_at=clock_timestamp() where id='d2000000-0000-4000-8000-000000000002';
-- Downstream failure rolls back both ticket state and idempotency record.
create function pg_temp.fail_call_event() returns trigger language plpgsql as $$begin raise exception 'injected call event failure'; end$$;
create trigger fail_call before insert on ticket_events for each row execute function pg_temp.fail_call_event();
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000004')$$,'P0001','injected call event failure','audit failure aborts call');
select is((select status::text from tickets where id='d2000000-0000-4000-8000-000000000003'),'waiting','failed call restores waiting state');
select is((select count(*) from queue_call_requests where request_id='d4000000-0000-4000-8000-000000000004'),0::bigint,'failed call leaves no success request record');
drop trigger fail_call on ticket_events;
update queues set status='paused' where slug='call-test';
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'QZ002',null,'paused queue cannot call');
update queues set status='closed' where slug='call-test';
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'QZ002',null,'closed queue cannot call');
update queues set status='open' where slug='call-test';
update locations set is_active=false where business_id=(select id from businesses where owner_user_id='call_owner');
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'QZ002',null,'inactive location cannot call');
update locations set is_active=true where business_id=(select id from businesses where owner_user_id='call_owner');
select is((select outcome from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000004')),'called','failed request can safely retry once dependency is fixed');
update tickets set status='completed',completed_at=clock_timestamp() where id='d2000000-0000-4000-8000-000000000003';
select is((select outcome from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000005')),'empty','empty queue returns a clean domain result');
select ok((select ticket_id is null and display_number is null and customer_name is null and called_at is null and ticket_status is null from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000005')),'empty response has no fabricated customer');
insert into tickets(queue_id,service_date,sequence_number,display_number,customer_name) values('d0000000-0000-4000-8000-000000000001',current_date,3,'A003','New arrival');
select is((select outcome from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000005')),'empty','retry of empty action does not unexpectedly call new arrival');
delete from queue_staff_assignments where business_member_id='d1000000-0000-4000-8000-000000000002';
select throws_ok($$select * from call_next_ticket('d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000003')$$,'42501',null,'revoked staff cannot replay private call results');
select * from finish();
rollback;
