begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(has_function_privilege('authenticated', 'public.onboard_business(text,text,text,text,text,text)', 'EXECUTE'), 'authenticated users may onboard');
select ok(not has_function_privilege('anon', 'public.onboard_business(text,text,text,text,text,text)', 'EXECUTE'), 'anonymous users cannot execute onboarding');
select ok(not has_function_privilege('service_role', 'public.onboard_business(text,text,text,text,text,text)', 'EXECUTE'), 'onboarding does not use service role identity');

set local role anon;
select throws_ok($$select onboard_business('Clinic A', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, '42501', null, 'anonymous onboarding is denied');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select onboard_business('Clinic A', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, '42501', 'Authentication required', 'missing JWT subject is denied');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_onboarding_a","owner_user_id":"user_victim","business_id":"00000000-0000-0000-0000-000000000000"}', true);
select lives_ok($$select onboard_business('  Clinic A  ', 'healthcare', 'gh', 'Africa/Accra', ' Main Branch ', ' 10 High Street, Accra ')$$, 'valid onboarding succeeds');
select is((select count(*) from businesses), 1::bigint, 'one business created');
select is((select owner_user_id from businesses), 'user_onboarding_a', 'owner is derived from subject, not extra ownership claims');
select is((select name from businesses), 'Clinic A', 'business name is trimmed');
select is((select country_code from businesses), 'GH', 'country is normalized');
select is((select subscription_tier::text from businesses), 'FREE', 'new business starts on the free tier');
select is((select role::text from business_members), 'owner', 'owner membership created');
select is((select name from locations), 'Main Branch', 'initial location created and trimmed');
select is((select address from locations), '10 High Street, Accra', 'initial location address saved');
select is((select timezone from locations), 'Africa/Accra', 'location uses the selected timezone');
select is((select count(*) from business_events), 1::bigint, 'creation is audited once');
select is((select actor_user_id from business_events), 'user_onboarding_a', 'audit actor is the verified user');
select is((select metadata->>'location_id' from business_events), (select id::text from locations), 'audit identifies the created location');
select is(onboard_business('Changed name', 'other', 'NG', 'Africa/Lagos', 'Second', 'Lagos'), (select id from businesses), 'retry returns the existing business');
select is((select name from businesses), 'Clinic A', 'retry cannot overwrite original details');
select is((select count(*) from locations), 1::bigint, 'retry does not duplicate locations');
select is((select count(*) from business_events), 1::bigint, 'retry does not duplicate audit events');
select throws_ok($$update businesses set subscription_tier = 'BUSINESS'$$, '42501', null, 'onboarding does not grant direct business writes');
select throws_ok($$insert into business_events (business_id, type, actor_user_id) select id, 'business_created', 'user_victim' from businesses$$, '42501', null, 'client cannot forge audit records');
reset role;
set constraints all immediate;
select pass('owner consistency constraints hold after onboarding');
set constraints all deferred;

-- Existing staff memberships also count as completed onboarding.
insert into business_members (business_id, clerk_user_id, role)
 select id, 'user_invited_staff', 'staff' from businesses where owner_user_id = 'user_onboarding_a';
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_invited_staff"}', true);
select is(onboard_business('Unneeded business', 'other', 'NG', 'Africa/Lagos', 'Main', 'Lagos'), (select business_id from business_members where clerk_user_id = 'user_invited_staff'), 'existing invited staff joins their existing workspace');
select is((select count(*) from business_events), 0::bigint, 'staff cannot read administrative audit events');
reset role;
select is((select count(*) from businesses), 1::bigint, 'staff replay creates no extra business');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_onboarding_b"}', true);
select is((select count(*) from businesses), 0::bigint, 'new user cannot see the first business');
select lives_ok($$select onboard_business('Clinic A', 'healthcare', 'NG', 'Africa/Lagos', 'Main', 'Lagos')$$, 'another user can choose the same business name');
select is((select owner_user_id from businesses), 'user_onboarding_b', 'second user owns only their business');
select is((select count(*) from business_events), 1::bigint, 'second user sees only their audit record');
reset role;
select is((select count(distinct slug) from businesses), 2::bigint, 'duplicate business names receive different slugs');
select ok(not exists(select 1 from businesses where slug like '%' || replace(id::text, '-', '') || '%'), 'public slug does not embed the internal business ID');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_invalid"}', true);
select throws_ok($$select onboard_business('', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, '22023', null, 'blank business name rejected');
select throws_ok($$select onboard_business('Clinic', 'unsupported', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, '22023', null, 'unknown industry rejected by direct RPC');
select throws_ok($$select onboard_business('Clinic', 'healthcare', 'ZZ', 'Africa/Accra', 'Main', 'Accra')$$, '22023', null, 'invalid country rejected by direct RPC');
select throws_ok($$select onboard_business('Clinic', 'healthcare', 'GH', 'Wrong/Zone', 'Main', 'Accra')$$, '22023', null, 'invalid timezone rejected');
select throws_ok($$select onboard_business('Clinic', 'healthcare', 'GH', 'Africa/Accra', 'Main', ' ')$$, '22023', null, 'blank address rejected');
select throws_ok($$select onboard_business(null, 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, '22023', null, 'null values rejected');
select is((select count(*) from businesses), 0::bigint, 'invalid submissions leave no business');
select is((select count(*) from business_members), 0::bigint, 'invalid submissions leave no membership');
reset role;

-- Force a failure AFTER business/membership insertion, not only pre-validation.
create function pg_temp.fail_test_location() returns trigger language plpgsql as $$
begin
  if new.name = 'FAIL_ONBOARDING_TEST' then raise exception 'Simulated location failure'; end if;
  return new;
end;
$$;
create trigger onboarding_test_failure before insert on locations for each row execute function pg_temp.fail_test_location();
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_rollback"}', true);
select throws_ok($$select onboard_business('Rollback Clinic', 'healthcare', 'GH', 'Africa/Accra', 'FAIL_ONBOARDING_TEST', 'Accra')$$, 'P0001', 'Simulated location failure', 'late failure aborts the entire operation');
select is((select count(*) from businesses), 0::bigint, 'failed transaction leaves no orphan business');
select is((select count(*) from business_members), 0::bigint, 'failed transaction leaves no orphan owner membership');
select is((select count(*) from business_events), 0::bigint, 'failed transaction leaves no success audit');
select lives_ok($$select onboard_business('Retry Clinic', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, 'a corrected retry succeeds after rollback');
select is((select count(*) from locations), 1::bigint, 'corrected retry creates one location');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_long_name"}', true);
select lives_ok($$select onboard_business(repeat('a', 59) || ' b', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, 'slug remains valid when truncation lands on a hyphen');
select ok((select slug !~ '--' from businesses), 'truncated slug contains no repeated hyphens');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_unicode_name"}', true);
select lives_ok($$select onboard_business('診療所', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')$$, 'non-Latin business names can onboard');
select ok((select slug ~ '^business-[a-f0-9]{32}$' from businesses), 'non-Latin names receive a valid fallback slug');
reset role;
select throws_ok('update business_events set metadata = ''{}''', '55000', 'Business events are append-only', 'audit events cannot be rewritten');
select throws_ok('delete from business_events', '55000', 'Business events are append-only', 'audit events cannot be removed');
set constraints all immediate;

select * from finish();
rollback;
