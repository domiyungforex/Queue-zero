begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"authenticated","sub":"ticket_owner"}',true);
select onboard_business('Ticket clinic','healthcare','GH','Africa/Accra','Main branch','Private address');
select create_queue('80000000-0000-4000-8000-000000000001',
 (select id from businesses where owner_user_id='ticket_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='ticket_owner'),
 'Consultation',null,300,3,false,false);
update queues set slug='ticket-test' where id='80000000-0000-4000-8000-000000000001';
insert into tickets(queue_id,public_token,service_date,sequence_number,display_number,customer_name,phone,status,joined_at,called_at,completed_at,cancelled_at,no_show_at) values
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',current_date-1,99,'A099','PRIVATE_YESTERDAY','+233555000001','waiting',now()-interval '1 day',null,null,null,null),
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002',current_date,1,'A001','PRIVATE_FIRST','+233555000002','waiting',now()-interval '10 minutes',null,null,null,null),
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003',current_date,2,'A002','PRIVATE_TARGET','+233555000003','waiting',now()-interval '5 minutes',null,null,null,null),
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000004',current_date,3,'A003','PRIVATE_SERVING',null,'serving',now()-interval '20 minutes',now()-interval '2 minutes',null,null,null),
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000005',current_date,4,'A004','PRIVATE_COMPLETED',null,'completed',now()-interval '30 minutes',now()-interval '25 minutes',now()-interval '21 minutes',null,null),
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000006',current_date,5,'A005','PRIVATE_CANCELLED',null,'cancelled',now()-interval '30 minutes',null,null,now(),null),
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000007',current_date,6,'A006','PRIVATE_NO_SHOW',null,'no_show',now()-interval '30 minutes',null,null,null,now());
select ok(has_function_privilege('anon','get_public_ticket(uuid)','EXECUTE'),'anonymous token read permitted');
select ok(not has_function_privilege('anon','cancel_public_ticket(uuid)','EXECUTE'),'anonymous direct mutation denied');
select ok(not has_function_privilege('authenticated','cancel_public_ticket(uuid)','EXECUTE'),'authenticated direct mutation denied');
select ok(has_function_privilege('service_role','cancel_public_ticket(uuid)','EXECUTE'),'controlled server action can cancel');
select set_config('test.internal_id',(select id::text from tickets where public_token='81000000-0000-4000-8000-000000000003'),true);
set local role anon;
select is((select people_ahead from get_public_ticket('81000000-0000-4000-8000-000000000003')),2::bigint,'counts earlier waiting tickets across date resets');
select is((select estimated_wait_seconds from get_public_ticket('81000000-0000-4000-8000-000000000003')),600::bigint,'live configured estimate');
select is((select people_ahead from get_public_ticket('81000000-0000-4000-8000-000000000001')),0::bigint,'head of waiting list has zero ahead');
select is((select has_serving_customer from get_public_ticket('81000000-0000-4000-8000-000000000001')),true,'head is informed of existing service');
select is((select people_ahead from get_public_ticket('81000000-0000-4000-8000-000000000004')),null::bigint,'serving ticket has no waiting position');
select is((select estimated_wait_seconds from get_public_ticket('81000000-0000-4000-8000-000000000005')),null::bigint,'completed ticket has no wait estimate');
select is((select count(*) from get_public_ticket(gen_random_uuid())),0::bigint,'unknown token reveals nothing');
select is((select count(*) from get_public_ticket(current_setting('test.internal_id')::uuid)),0::bigint,'internal UUID cannot retrieve ticket');
select is((select count(*) from get_public_ticket(null)),0::bigint,'null token reveals nothing');
select is((select string_agg(key,',' order by key) from jsonb_object_keys((select to_jsonb(t) from get_public_ticket('81000000-0000-4000-8000-000000000003') t)) keys(key)),
 'business_name,display_number,estimated_wait_seconds,has_serving_customer,joined_at,location_active,location_name,location_timezone,people_ahead,queue_name,queue_slug,queue_status,status','public detail contract excludes identity and internal IDs');
select ok((select to_jsonb(t)::text !~ 'PRIVATE_|233555|80000000|owner|subscription' from get_public_ticket('81000000-0000-4000-8000-000000000003') t),'projection contains no private fixture data');
select throws_ok('select * from tickets','42501',null,'raw ticket table remains inaccessible');
reset role;
update queues set average_service_seconds=600,status='paused' where slug='ticket-test';
select is((select estimated_wait_seconds from get_public_ticket('81000000-0000-4000-8000-000000000003')),null::bigint,'paused queue suppresses active estimate');
select is((select people_ahead from get_public_ticket('81000000-0000-4000-8000-000000000003')),2::bigint,'paused queue preserves position');
set local role service_role;
select is(cancel_public_ticket('81000000-0000-4000-8000-000000000001')::text,'cancelled','customer can cancel while paused');
select is(cancel_public_ticket('81000000-0000-4000-8000-000000000001')::text,'cancelled','repeat cancellation is idempotent');
reset role;
select is((select count(*) from ticket_events where ticket_id=(select id from tickets where public_token='81000000-0000-4000-8000-000000000001') and type='cancelled' and actor_type='customer'),1::bigint,'exactly one customer cancellation event');
select ok((select cancelled_at>=joined_at from tickets where public_token='81000000-0000-4000-8000-000000000001'),'cancellation timestamp recorded');
select is((select people_ahead from get_public_ticket('81000000-0000-4000-8000-000000000003')),1::bigint,'next read immediately reflects cancellation');
update queues set status='open' where slug='ticket-test';
select is((select estimated_wait_seconds from get_public_ticket('81000000-0000-4000-8000-000000000003')),600::bigint,'estimate uses updated configuration and current position');
select throws_ok($$select cancel_public_ticket('81000000-0000-4000-8000-000000000004')$$,'QZ007',null,'cannot cancel serving customer');
select throws_ok($$select cancel_public_ticket('81000000-0000-4000-8000-000000000005')$$,'QZ007',null,'cannot cancel completed customer');
select throws_ok($$select cancel_public_ticket('81000000-0000-4000-8000-000000000007')$$,'QZ007',null,'cannot cancel no-show');
select throws_ok('select cancel_public_ticket(gen_random_uuid())','QZ001',null,'unknown cancellation target rejected');
create function pg_temp.fail_cancel_event() returns trigger language plpgsql as $$begin raise exception 'injected cancellation event failure'; end$$;
create trigger fail_cancel before insert on ticket_events for each row execute function pg_temp.fail_cancel_event();
select throws_ok($$select cancel_public_ticket('81000000-0000-4000-8000-000000000003')$$,'P0001','injected cancellation event failure','audit failure aborts cancellation');
select is((select status::text from tickets where public_token='81000000-0000-4000-8000-000000000003'),'waiting','ticket state rolled back with event failure');
select is((select cancelled_at from tickets where public_token='81000000-0000-4000-8000-000000000003'),null::timestamptz,'timestamp rolled back with event failure');
drop trigger fail_cancel on ticket_events;
update locations set is_active=false where business_id=(select id from businesses where owner_user_id='ticket_owner');
select is((select location_active from get_public_ticket('81000000-0000-4000-8000-000000000003')),false,'inactive location does not hide existing ticket');
select is((select estimated_wait_seconds from get_public_ticket('81000000-0000-4000-8000-000000000003')),null::bigint,'inactive location suppresses estimate');
select lives_ok($$select cancel_public_ticket('81000000-0000-4000-8000-000000000003')$$,'customer can cancel after location deactivation');
select is((select count(*) from tickets where queue_id='80000000-0000-4000-8000-000000000001'),7::bigint,'cancellation never deletes ticket history');
select * from finish();
rollback;
