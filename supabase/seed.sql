-- LOCAL DEMO ONLY: apply to an empty development database after migrations.
-- Never apply automatically to a production database.
-- LOCAL PREVIEW ONLY. The launcher applies this only to a fresh disposable DB.
begin;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"local_preview_owner"}',true);
select public.onboard_business('QueueZero Demo Clinic','healthcare','GH','Africa/Accra','Demo Main Branch','Demo address');
select public.create_queue('90000000-0000-4000-8000-000000000001',
 (select id from public.businesses where owner_user_id='local_preview_owner'),
 (select l.id from public.locations l join public.businesses b on b.id=l.business_id where b.owner_user_id='local_preview_owner'),
 'Doctor Consultation','Local demo queue. Try joining, checking your place, and leaving the queue.',300,3,true,false);
update public.queues set slug='demo-clinic' where id='90000000-0000-4000-8000-000000000001';
-- Create real tickets through the same atomic mutation used by the application.
select public.join_public_queue('demo-clinic',gen_random_uuid(),repeat('a',64),repeat('f',64),'Demo customer one',null);
select public.join_public_queue('demo-clinic',gen_random_uuid(),repeat('b',64),repeat('f',64),'Demo customer two',null);
select public.join_public_queue('demo-clinic',gen_random_uuid(),repeat('c',64),repeat('f',64),'Demo customer three',null);
commit;
