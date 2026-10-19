begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_notification_owner"}',true);
select onboard_business('Notification test','education','NG','Africa/Lagos','Campus','Test campus') as org \gset
select gen_random_uuid() as class_id \gset

reset role;
insert into public.business_events (business_id,type,actor_user_id,metadata)
values (:'org','school_open','user_notification_owner',jsonb_build_object('id',:'class_id'));

set local role authenticated;
select is(
  (workspace_notification_snapshot(:'org',30)->>'unread')::integer,
  1,
  'a relevant workspace event creates one unread notification'
);
select is(
  workspace_notification_snapshot(:'org',30)->'items'->0->>'href',
  '/dashboard/attendance/' || :'class_id',
  'notification action remains inside the authorized workspace UI'
);
select is(mark_workspace_notifications_read(:'org',null),1,'member can mark workspace notifications read');
select is(
  (workspace_notification_snapshot(:'org',30)->>'unread')::integer,
  0,
  'read state is reflected immediately'
);

reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_notification_other"}',true);
set local role authenticated;
select throws_ok(
  format('select workspace_notification_snapshot(%L,30)', :'org'),
  '42501',
  'Workspace unavailable',
  'a non-member cannot read the workspace inbox'
);
select is((select count(*) from workspace_notifications),0::bigint,'RLS hides workspace notifications from non-members');

select * from finish();
rollback;
