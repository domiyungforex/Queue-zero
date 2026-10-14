begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(
  has_function_privilege(
    'authenticated',
    'public.onboard_organization_workspace(uuid,text,public.organization_type,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users can invoke controlled organization onboarding'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.onboard_organization_workspace(uuid,text,public.organization_type,text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot create organization workspaces'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_workspace_owner"}', true);
select onboard_professional_workspace(
  'Personal teaching', 'LECTURER_TEACHER', 'NG', 'Africa/Lagos'
) as personal_workspace \gset
select onboard_organization_workspace(
  '10000000-0000-4000-8000-000000000001',
  'Independent school',
  'UNIVERSITY_SCHOOL',
  'NG',
  'Africa/Lagos',
  'Main campus',
  'Lagos'
) as organization_workspace \gset

select isnt(
  :'personal_workspace'::uuid,
  :'organization_workspace'::uuid,
  'an existing personal workspace does not absorb organization onboarding'
);
select is(
  (select count(*) from business_members where clerk_user_id = 'user_workspace_owner'),
  2::bigint,
  'one Clerk identity can own personal and organization workspaces'
);
select is(
  onboard_organization_workspace(
    '10000000-0000-4000-8000-000000000001',
    'Ignored retry',
    'COMPANY_OTHER',
    'GH',
    'Africa/Accra',
    'Ignored',
    'Ignored'
  ),
  :'organization_workspace'::uuid,
  'the same actor and request key return the persisted workspace'
);
select is(
  (select organization_type::text from businesses where id = :'organization_workspace'),
  'UNIVERSITY_SCHOOL',
  'organization type is stored as server-controlled metadata'
);
select is(
  (select institution_type from businesses where id = :'organization_workspace'),
  'OTHER',
  'school organization onboarding reuses institution setup'
);
select ok(
  (select onboarding_completed_at is not null from businesses where id = :'organization_workspace'),
  'organization completion is recorded after its creation event'
);
select ok(
  (select onboarding_completed_at is not null from businesses where id = :'personal_workspace'),
  'professional workspace completion is recorded from its creation event'
);
select is(
  (select count(*) from locations where business_id = :'organization_workspace'),
  1::bigint,
  'organization onboarding persists exactly one initial location'
);

select onboard_organization_workspace(
  '10000000-0000-4000-8000-000000000002',
  'Second organization',
  'COMPANY_OTHER',
  'GH',
  'Africa/Accra',
  'Head office',
  'Accra'
) as second_owned_workspace \gset
select isnt(
  :'second_owned_workspace'::uuid,
  :'organization_workspace'::uuid,
  'different request keys allow an owner to create distinct organizations'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_other_tenant"}', true);
select onboard_organization_workspace(
  '10000000-0000-4000-8000-000000000001',
  'Other tenant clinic',
  'HOSPITAL_CLINIC',
  'GH',
  'Africa/Accra',
  'Clinic',
  'Kumasi'
) as other_workspace \gset
select isnt(
  :'other_workspace'::uuid,
  :'organization_workspace'::uuid,
  'request keys are scoped to the authenticated owner'
);
set local role authenticated;
select is((select count(*) from businesses), 1::bigint, 'RLS reveals only the current user workspace');
select is((select id from businesses), :'other_workspace'::uuid, 'RLS cannot cross organization boundaries');
reset role;

reset role;
insert into business_members (business_id, clerk_user_id, role)
values (:'other_workspace', 'user_revoked_member', 'staff');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_revoked_member"}', true);
set local role authenticated;
select is((select count(*) from businesses), 1::bigint, 'an active member can read the assigned workspace');
reset role;
delete from business_members
where business_id = :'other_workspace'
  and clerk_user_id = 'user_revoked_member';
set local role authenticated;
select is((select count(*) from businesses), 0::bigint, 'membership removal immediately revokes workspace reads');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select onboard_organization_workspace(
    '20000000-0000-4000-8000-000000000001', 'No identity', 'COMPANY_OTHER',
    'NG', 'Africa/Lagos', 'Main', 'Lagos'
  )$$,
  '42501',
  'Authentication required',
  'organization onboarding fails closed without a Clerk subject'
);

select * from finish();
rollback;
