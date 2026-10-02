begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(10);
select to_regclass('realtime.test_broadcasts') is not null as capture_available \gset
\if :capture_available
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_live_owner"}',true);
select onboard_business('Live clinic','healthcare','NG','Africa/Lagos','Main','Address');
select ok(exists(select 1 from realtime.test_broadcasts where topic='business:'||(select id from businesses where owner_user_id='user_live_owner')),'onboarding emits business invalidation');
truncate realtime.test_broadcasts;
select create_queue('ac000000-0000-4000-8000-000000000001',
 (select id from businesses where owner_user_id='user_live_owner'),
 (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='user_live_owner'),
 'Consultation',null,300,3,false,false);
select ok(exists(select 1 from realtime.test_broadcasts where topic like 'business:%'),'queue creation updates business screens');
select ok(exists(select 1 from realtime.test_broadcasts where topic='public-queue:'||(select slug from queues where id='ac000000-0000-4000-8000-000000000001')),'queue creation updates public queue');
truncate realtime.test_broadcasts;
update queues set name='Updated service' where id='ac000000-0000-4000-8000-000000000001';
select ok(exists(select 1 from realtime.test_broadcasts where topic='queue:ac000000-0000-4000-8000-000000000001'),'service edits update staff console');
select join_public_queue((select slug from queues where id='ac000000-0000-4000-8000-000000000001'),gen_random_uuid(),repeat('a',64),repeat('b',64),'Private name',null);
truncate realtime.test_broadcasts;
update locations set is_active=false where business_id=(select id from businesses where owner_user_id='user_live_owner');
select ok(exists(select 1 from realtime.test_broadcasts where topic like 'ticket:%'),'location availability updates customer tickets');
select ok(exists(select 1 from realtime.test_broadcasts where topic like 'business:%'),'location availability updates business screens');
truncate realtime.test_broadcasts;
select save_staff((select id from businesses where owner_user_id='user_live_owner'),'user_livestaff','staff',array['ac000000-0000-4000-8000-000000000001'::uuid],false);
select ok(exists(select 1 from realtime.test_broadcasts where topic like 'business:%'),'team changes update business screens');
truncate realtime.test_broadcasts;
insert into subscriptions(business_id,plan,status) select id,'FREE','active' from businesses where owner_user_id='user_live_owner';
select ok(exists(select 1 from realtime.test_broadcasts where topic like 'business:%'),'subscription changes update billing screens');
select ok((select bool_and(payload='{"changed":true}'::jsonb and event='changed' and private) from realtime.test_broadcasts),'broadcasts contain only private invalidations');
select ok(not has_function_privilege('anon','private.publish_business_update()','EXECUTE') and not has_function_privilege('authenticated','private.publish_queue_details_update()','EXECUTE'),'trigger helpers are not client-callable');
\else
select skip('Broadcast capture is provided only by db:test:isolated',10);
\endif
select * from finish();
rollback;
