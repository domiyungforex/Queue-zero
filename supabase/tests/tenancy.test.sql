begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Two unrelated tenants, manager/staff roles, and one deliberately unassigned staff user.
insert into businesses (id, name, slug, owner_user_id, industry, timezone, country_code) values
 ('10000000-0000-0000-0000-000000000001', 'Business A', 'business-a', 'user_owner_a', 'clinic', 'Africa/Accra', 'GH'),
 ('10000000-0000-0000-0000-000000000002', 'Business B', 'business-b', 'user_owner_b', 'salon', 'Africa/Lagos', 'NG');
insert into business_members (id, business_id, clerk_user_id, role) values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'user_owner_a', 'owner'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'user_admin_a', 'admin'),
 ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'user_staff_a', 'staff'),
 ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'user_unassigned', 'staff'),
 ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'user_owner_b', 'owner'),
 ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'user_staff_b', 'staff');
insert into locations (id, business_id, name, address) values
 ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Main A', 'Address A'),
 ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Main B', 'Address B');
insert into queues (id, business_id, location_id, name, slug) values
 ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Assigned A', 'assigned-a'),
 ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Other A', 'other-a'),
 ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Queue B', 'queue-b');
insert into queue_staff_assignments (business_id, queue_id, business_member_id) values
 ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'),
 ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000006');
insert into tickets (id, queue_id, public_token, service_date, sequence_number, display_number, customer_name, phone, joined_at) values
 ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '2026-10-01', 1, 'A001', 'Customer A', '+233555000001', '2026-10-01 09:00:00+00'),
 ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '2026-10-01', 1, 'A001', 'Other A', '+233555000002', '2026-10-01 09:00:00+00'),
 ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', '2026-10-01', 1, 'A001', 'Customer B', '+234555000003', '2026-10-01 09:00:00+00');
insert into ticket_events (ticket_id, queue_id, type, actor_type)
 select id, queue_id, 'joined', 'customer' from tickets;
insert into notifications (ticket_id, channel, type, deduplication_key)
 select id, 'web_push', 'almost_your_turn', id::text || ':almost:1' from tickets;
insert into subscriptions (business_id) select id from businesses;
insert into push_subscriptions (clerk_user_id, endpoint, p256dh, auth) values
 ('user_owner_a', 'https://push.example.invalid/owner-a', 'test-public-key', 'test-auth'),
 ('user_owner_b', 'https://push.example.invalid/owner-b', 'test-public-key', 'test-auth');
insert into push_subscriptions (ticket_id, endpoint, p256dh, auth) values
 ('50000000-0000-0000-0000-000000000001', 'https://push.example.invalid/customer-a', 'test-public-key', 'test-auth');
insert into webhook_events (provider, provider_event_id, event_type, payload) values ('paystack', 'event-1', 'charge.success', '{}');
insert into queue_daily_counters (queue_id, service_date, last_number)
 select id, '2026-10-01', 1 from queues;
set constraints all immediate;
select pass('A business and its owner can be created in the same transaction');

select ok(c.relrowsecurity and c.relforcerowsecurity, c.relname || ' has forced RLS')
 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
select ok(not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'), c.relname || ' has no anonymous grants')
 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
select ok(not has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'), c.relname || ' has no direct client writes')
 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anonymous users cannot access policy helpers');
select ok(not has_schema_privilege('authenticated', 'public', 'CREATE'), 'authenticated users cannot inject schema objects');
select ok(not has_function_privilege('authenticated', 'private.enforce_business_owner()', 'EXECUTE'), 'clients cannot invoke privileged trigger functions');
select ok(not exists (
 select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and p.prosecdef and not coalesce('search_path=""' = any(p.proconfig), false)
), 'every privileged helper has an empty search_path');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_owner_a","role":"authenticated"}', true);
select is(private.current_clerk_user_id(), 'user_owner_a', 'Clerk text subject is accepted without UUID casting');
select is((select count(*) from businesses), 1::bigint, 'owner sees only their business');
select is((select count(*) from business_members), 4::bigint, 'owner sees their business memberships only');
select is((select count(*) from locations), 1::bigint, 'owner sees their location only');
select is((select count(*) from queues), 2::bigint, 'owner sees both queues in their tenant');
select is((select count(*) from tickets), 2::bigint, 'owner sees tenant tickets only');
select is((select count(*) from ticket_events), 2::bigint, 'owner sees tenant ticket history only');
select is((select count(*) from notifications), 2::bigint, 'owner sees tenant notifications only');
select is((select count(*) from subscriptions), 1::bigint, 'owner sees their billing record only');
select is((select count(*) from queue_staff_assignments), 1::bigint, 'owner sees tenant assignments only');
select is((select count(*) from push_subscriptions), 1::bigint, 'owner sees only their own push keys, not customer keys');
select is((select count(*) from tickets where public_token = '60000000-0000-0000-0000-000000000003'), 0::bigint, 'knowing another tenant public token does not bypass RLS');
select is((select count(*) from businesses where id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'submitted foreign business ID does not grant access');
select throws_ok('select * from webhook_events', '42501', null, 'raw webhooks are private even to owners');
select throws_ok('select * from queue_daily_counters', '42501', null, 'ticket counters are internal');
select throws_ok($$update businesses set subscription_tier = 'BUSINESS'$$, '42501', null, 'owners cannot grant themselves paid plans');
select throws_ok($$update business_members set role = 'owner' where clerk_user_id = 'user_admin_a'$$, '42501', null, 'membership writes require a controlled operation');
select throws_ok($$insert into business_members (business_id, clerk_user_id) values ('10000000-0000-0000-0000-000000000002', 'user_owner_a')$$, '42501', null, 'owner cannot self-join another tenant');

select set_config('request.jwt.claims', '{"sub":"user_admin_a","role":"authenticated"}', true);
select is((select count(*) from queues), 2::bigint, 'admin sees tenant queues');
select is((select count(*) from business_members), 4::bigint, 'admin sees tenant members');
select is((select count(*) from subscriptions), 0::bigint, 'admin cannot view owner-only billing');
select is((select count(*) from notifications), 2::bigint, 'admin can inspect tenant notification status');
select is((select count(*) from push_subscriptions), 0::bigint, 'admin cannot read other users push secrets');

select set_config('request.jwt.claims', '{"sub":"user_staff_a","role":"authenticated"}', true);
select is((select count(*) from businesses), 1::bigint, 'staff sees their business');
select is((select count(*) from business_members), 1::bigint, 'staff sees only their own membership');
select is((select count(*) from queues), 1::bigint, 'staff sees only assigned queues');
select is((select count(*) from tickets), 1::bigint, 'staff sees only assigned customer data');
select is((select customer_name from tickets), 'Customer A', 'staff receives the assigned customer, not another queue');
select is((select count(*) from ticket_events), 1::bigint, 'staff history is assignment scoped');
select is((select count(*) from queue_staff_assignments), 1::bigint, 'staff sees own assignments only');
select is((select count(*) from notifications), 0::bigint, 'staff cannot read administrative notification logs');
select is((select count(*) from subscriptions), 0::bigint, 'staff cannot read billing');
select throws_ok($$update tickets set status = 'serving', called_at = now()$$, '42501', null, 'staff cannot bypass transactional ticket operations');

select set_config('request.jwt.claims', '{"sub":"user_unassigned","role":"authenticated"}', true);
select is((select count(*) from queues), 0::bigint, 'unassigned staff sees no queues');
select is((select count(*) from tickets), 0::bigint, 'unassigned staff sees no customer data');
select is((select count(*) from ticket_events), 0::bigint, 'unassigned staff sees no history');

select set_config('request.jwt.claims', '{"sub":"user_owner_b","role":"authenticated"}', true);
select is((select slug from businesses), 'business-b', 'second owner sees only their business');
select is((select customer_name from tickets), 'Customer B', 'second owner cannot read first tenant customers');
select is((select count(*) from business_members), 2::bigint, 'second owner sees only their members');
select is((select count(*) from subscriptions), 1::bigint, 'second owner sees their subscription');

select set_config('request.jwt.claims', '{"sub":"user_outsider","role":"authenticated","business_id":"10000000-0000-0000-0000-000000000001","org_role":"org:admin","user_metadata":{"role":"owner"}}', true);
select is((select count(*) from businesses), 0::bigint, 'membership cannot be forged using unrelated JWT claims');
select is((select count(*) from queues), 0::bigint, 'signed-in outsider sees no queues');
select is((select count(*) from tickets), 0::bigint, 'signed-in outsider sees no tickets');
select is((select count(*) from locations), 0::bigint, 'signed-in outsider sees no locations');
select is((select count(*) from business_members), 0::bigint, 'signed-in outsider sees no members');
select is((select count(*) from subscriptions), 0::bigint, 'signed-in outsider sees no subscriptions');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select is((select count(*) from businesses), 0::bigint, 'missing subject fails closed');
select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
select is((select count(*) from businesses), 0::bigint, 'missing role claim fails closed');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select * from businesses', '42501', null, 'public users cannot enumerate businesses');
select throws_ok('select * from queues', '42501', null, 'public users cannot enumerate private queues');
select throws_ok($$select customer_name, phone from tickets where public_token = '60000000-0000-0000-0000-000000000001'$$, '42501', null, 'public token is not unrestricted table access');
select throws_ok('select * from push_subscriptions', '42501', null, 'public users cannot read push secrets');
select throws_ok($$select private.business_role_for('10000000-0000-0000-0000-000000000001')$$, '42501', null, 'anonymous callers cannot invoke policy helpers');
reset role;

-- Defense in depth: even accidental grants do not create RLS mutation policies.
grant update on business_members to authenticated;
grant insert on business_members to authenticated;
grant select on tickets to anon;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_staff_a","role":"authenticated"}', true);
update business_members set role = 'owner' where clerk_user_id = 'user_staff_a';
select is((select role::text from business_members where clerk_user_id = 'user_staff_a'), 'staff', 'RLS prevents privilege escalation even with an accidental UPDATE grant');
select throws_ok($$insert into business_members (business_id, clerk_user_id) values ('10000000-0000-0000-0000-000000000002', 'user_staff_a')$$, '42501', null, 'RLS rejects cross-tenant inserts even with an accidental INSERT grant');
set local role anon;
select is((select count(*) from tickets), 0::bigint, 'RLS prevents anonymous reads even with an accidental SELECT grant');
reset role;

-- Trusted writes must still honor structural invariants.
select throws_ok($$update queues set location_id = '30000000-0000-0000-0000-000000000002' where id = '40000000-0000-0000-0000-000000000001'$$, '23503', null, 'queue cannot point at another tenant location');
select throws_ok($$insert into queue_staff_assignments (business_id, queue_id, business_member_id) values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006')$$, '23503', null, 'queue assignment cannot use another tenant member');
select throws_ok($$insert into queue_staff_assignments (business_id, queue_id, business_member_id) values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003')$$, '23503', null, 'queue assignment cannot use another tenant queue');
select throws_ok($$insert into ticket_events (ticket_id, queue_id, type, actor_type) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'called', 'staff')$$, '23503', null, 'event cannot reference a ticket from another queue');
select throws_ok($$update business_members set role = 'admin' where clerk_user_id = 'user_owner_a'$$, '23514', null, 'business must retain its matching owner role');
select throws_ok($$update businesses set owner_user_id = 'user_staff_a' where slug = 'business-a'$$, '23514', null, 'owner pointer cannot target a staff membership');
select throws_ok($$delete from business_members where clerk_user_id = 'user_owner_a'$$, '23503', null, 'business cannot lose its owner membership');
select throws_ok($$update businesses set timezone = 'Invalid/Zone' where slug = 'business-a'$$, '23514', null, 'business timezone must exist');
select throws_ok($$update locations set timezone = 'Invalid/Zone'$$, '23514', null, 'location timezone must exist');
select throws_ok($$update queues set require_phone = true, allow_phone = false$$, '23514', null, 'required phone implies phone enabled');
select throws_ok($$update queues set average_service_seconds = 0$$, '23514', null, 'service estimate must be positive');
select throws_ok($$update queue_daily_counters set last_number = -1$$, '23514', null, 'daily counter cannot become negative');
select throws_ok($$insert into queue_daily_counters (queue_id, service_date) values ('40000000-0000-0000-0000-000000000001', '2026-10-01')$$, '23505', null, 'only one daily counter exists per queue/date');
select throws_ok($$insert into tickets (queue_id, service_date, sequence_number, display_number, customer_name) values ('40000000-0000-0000-0000-000000000001', '2026-10-01', 1, 'A001', 'Duplicate')$$, '23505', null, 'ticket sequence is unique per queue/date');
select lives_ok($$insert into tickets (queue_id, service_date, sequence_number, display_number, customer_name) values ('40000000-0000-0000-0000-000000000001', '2026-10-02', 1, 'A001', 'Next day')$$, 'sequence can restart on a new service date');
select throws_ok($$update tickets set status = 'serving' where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'serving requires a called timestamp');
select lives_ok($$update tickets set status = 'serving', called_at = '2026-10-01 09:05:00+00' where id = '50000000-0000-0000-0000-000000000001'$$, 'valid serving state is accepted');
select throws_ok($$insert into tickets (queue_id, service_date, sequence_number, display_number, customer_name, status, called_at) values ('40000000-0000-0000-0000-000000000001', '2026-10-01', 2, 'A002', 'Second serving', 'serving', now())$$, '23505', null, 'queue cannot serve two tickets at once');
select throws_ok($$update tickets set status = 'completed' where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'completion requires its timestamp');
select lives_ok($$update tickets set status = 'completed', completed_at = '2026-10-01 09:10:00+00' where id = '50000000-0000-0000-0000-000000000001'$$, 'valid completion is accepted');
select throws_ok($$update tickets set status = 'no_show' where id = '50000000-0000-0000-0000-000000000002'$$, '23514', null, 'no-show requires a timestamp');
select throws_ok($$update tickets set status = 'cancelled', cancelled_at = '2026-10-01 08:00:00+00' where id = '50000000-0000-0000-0000-000000000002'$$, '23514', null, 'cancellation cannot predate joining');
select throws_ok($$insert into webhook_events (provider, provider_event_id, event_type, payload) values ('paystack', 'event-1', 'charge.success', '{}')$$, '23505', null, 'webhook retries cannot create duplicate events');
select throws_ok($$insert into notifications (ticket_id, channel, type, deduplication_key) values ('50000000-0000-0000-0000-000000000001', 'web_push', 'almost_your_turn', '50000000-0000-0000-0000-000000000001:almost:1')$$, '23505', null, 'notification retries have stable deduplication keys');
select throws_ok($$insert into push_subscriptions (endpoint, p256dh, auth) values ('https://push.example.invalid/no-owner', 'test', 'test')$$, '23514', null, 'push subscriptions require a target');
select throws_ok($$insert into push_subscriptions (ticket_id, clerk_user_id, endpoint, p256dh, auth) values ('50000000-0000-0000-0000-000000000001', 'user_owner_a', 'https://push.example.invalid/two-owners', 'test', 'test')$$, '23514', null, 'push subscriptions cannot have ambiguous ownership');

set local role service_role;
select is((select count(*) from businesses), 2::bigint, 'service role has its explicit privileged access');
select throws_ok('update ticket_events set metadata = ''{}''', '55000', 'Ticket events are append-only', 'even service role cannot rewrite history');
select throws_ok('delete from ticket_events', '55000', 'Ticket events are append-only', 'even service role cannot erase history');
select throws_ok('truncate ticket_events', '42501', null, 'service role cannot bypass history protection with TRUNCATE');
reset role;

select * from finish();
rollback;
