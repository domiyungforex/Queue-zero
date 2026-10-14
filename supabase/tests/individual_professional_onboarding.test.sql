begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(
  has_function_privilege(
    'authenticated',
    'public.onboard_professional_workspace_v2(text,public.professional_category,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users can invoke controlled professional onboarding'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.onboard_professional_workspace_v2(text,public.professional_category,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot create professional workspaces'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_all_professions"}', true);
select onboard_professional_workspace_v2(
  'Independent Physics', 'LECTURER_TEACHER', 'NG', 'Africa/Lagos',
  'University undergraduate', 'Example University', null, null, null
) as lecturer_workspace \gset
select onboard_professional_workspace_v2(
  'Dr Ada Consults', 'DOCTOR', 'NG', 'Africa/Lagos',
  null, null, 'Consultations', 'Authorized practice', 'Lagos'
) as doctor_workspace \gset
select onboard_professional_workspace_v2(
  'Nurse Ada Services', 'NURSE', 'NG', 'Africa/Lagos',
  null, null, 'Nursing service', 'Authorized practice', 'Lagos'
) as nurse_workspace \gset
select onboard_professional_workspace_v2(
  'Ada Client Service', 'BANKER', 'NG', 'Africa/Lagos',
  null, null, 'Customer service', 'Private office', 'Lagos'
) as banker_workspace \gset
select onboard_professional_workspace_v2(
  'Ada Styles', 'BARBER_STYLIST', 'NG', 'Africa/Lagos',
  null, null, 'Hair styling', 'Studio', 'Lagos'
) as barber_workspace \gset
select onboard_professional_workspace_v2(
  'Ada Advisory', 'CONSULTANT', 'NG', 'Africa/Lagos',
  null, null, 'Advisory sessions', 'Consulting room', 'Lagos'
) as consultant_workspace \gset
select onboard_professional_workspace_v2(
  'Ada Professional Services', 'OTHER_PROFESSIONAL', 'NG', 'Africa/Lagos',
  null, null, 'Custom service', 'Service point', 'Lagos'
) as other_workspace \gset

select is(
  (select count(*) from business_members where clerk_user_id = 'user_all_professions'),
  7::bigint,
  'one Clerk identity can own one workspace for each supported profession'
);
select is(
  (select count(*) from professional_workspace_profiles),
  7::bigint,
  'each professional workspace has a persisted typed profile'
);
select is(
  (select count(*) from professional_workspace_profiles where professional_category <> 'LECTURER_TEACHER' and practice_location_id is not null),
  6::bigint,
  'every service profession has a real persisted practice location'
);
select is(
  (select organization_mode::text from businesses where id = :'lecturer_workspace'),
  'SCHOOL',
  'lecturers reuse the existing school and attendance modules'
);
select is(
  (select teaching_level from professional_workspace_profiles where business_id = :'lecturer_workspace'),
  'University undergraduate',
  'lecturer teaching configuration is persisted'
);
select is(
  (select organization_mode::text from businesses where id = :'doctor_workspace'),
  'BUSINESS',
  'service professionals reuse the existing queue module'
);
select is(
  (select industry from businesses where id = :'barber_workspace'),
  'beauty_wellness',
  'profession maps to existing operational industry metadata'
);
select is(
  (select count(*) from businesses where owner_user_id = 'user_all_professions' and institution_type is not null),
  0::bigint,
  'personal workspaces never claim an official institution type'
);
select is(
  onboard_professional_workspace_v2(
    'Ignored retry name', 'DOCTOR', 'GH', 'Africa/Accra',
    null, null, 'Ignored service', 'Ignored location', 'Ignored address'
  ),
  :'doctor_workspace'::uuid,
  'repeated professional onboarding is idempotent per actor and category'
);
select is(
  (select count(*) from locations where business_id = :'doctor_workspace'),
  1::bigint,
  'an idempotent retry does not duplicate the practice location'
);

select throws_ok(
  $$select onboard_professional_workspace_v2(
    'Incomplete doctor', 'DOCTOR', 'NG', 'Africa/Lagos',
    null, null, null, 'Office', 'Lagos'
  )$$,
  '22023',
  'Invalid service workspace details',
  'service onboarding rejects incomplete configuration'
);
select throws_ok(
  $$select onboard_professional_workspace_v2(
    'Overreaching lecturer', 'LECTURER_TEACHER', 'NG', 'Africa/Lagos',
    'Secondary', 'School name', 'Extra service', null, null
  )$$,
  '22023',
  'Invalid teaching workspace details',
  'lecturer onboarding rejects unrelated service configuration'
);

set local role authenticated;
select is((select count(*) from professional_workspace_profiles), 7::bigint, 'profile RLS exposes the member workspaces');
select throws_ok(
  format('update professional_workspace_profiles set service_name = ''Changed'' where business_id = %L', :'doctor_workspace'),
  '42501',
  null,
  'clients cannot bypass the controlled profile write path'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"user_professional_outsider","email":"person@example-university.edu","user_metadata":{"institution":"Example University"}}',
  true
);
set local role authenticated;
select is((select count(*) from professional_workspace_profiles), 0::bigint, 'name, domain and metadata do not grant profile access');
select is((select count(*) from locations), 0::bigint, 'outsiders cannot read professional locations');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_organization_regression"}', true);
select onboard_organization_workspace(
  '40000000-0000-4000-8000-000000000001',
  'Existing organization flow', 'COMPANY_OTHER', 'NG', 'Africa/Lagos', 'Head office', 'Lagos'
) as organization_workspace \gset
select is(
  (select workspace_ownership::text from businesses where id = :'organization_workspace'),
  'ORGANIZATION',
  'existing organization onboarding remains organization-owned'
);
select is(
  (select count(*) from professional_workspace_profiles where business_id = :'organization_workspace'),
  0::bigint,
  'organization onboarding does not create a personal professional profile'
);

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select onboard_professional_workspace_v2(
    'No identity', 'CONSULTANT', 'NG', 'Africa/Lagos',
    null, null, 'Consulting', 'Office', 'Lagos'
  )$$,
  '42501',
  'Authentication required',
  'professional onboarding fails closed without a Clerk subject'
);

select * from finish();
rollback;
