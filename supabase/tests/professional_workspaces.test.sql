begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(
  not has_function_privilege(
    'anon',
    'public.onboard_professional_workspace(text,public.professional_category,text,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot create professional workspaces'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.onboard_professional_workspace(text,public.professional_category,text,text)',
    'EXECUTE'
  ),
  'authenticated clients can use the controlled onboarding operation'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_dual_member"}', true);
select onboard_organization(
  'Official school',
  'education',
  'NG',
  'Africa/Lagos',
  'Main campus',
  'Campus address',
  'SCHOOL'
) as official_workspace \gset

select onboard_professional_workspace(
  'My teaching workspace',
  'LECTURER_TEACHER',
  'NG',
  'Africa/Lagos'
) as personal_workspace \gset

select isnt(
  :'personal_workspace'::uuid,
  :'official_workspace'::uuid,
  'personal and official workspaces are distinct'
);
select is(
  onboard_professional_workspace('Ignored retry name', 'LECTURER_TEACHER', 'NG', 'Africa/Lagos'),
  :'personal_workspace'::uuid,
  'professional workspace onboarding is idempotent'
);
select is(
  (select count(*) from business_members where clerk_user_id = 'user_dual_member'),
  2::bigint,
  'one Clerk identity can belong to official and personal workspaces'
);
select is(
  (select workspace_ownership::text from businesses where id = :'official_workspace'),
  'ORGANIZATION',
  'existing organization onboarding retains organization ownership'
);
select is(
  (select workspace_ownership::text from businesses where id = :'personal_workspace'),
  'INDIVIDUAL',
  'professional workspace has explicit individual ownership'
);
select is(
  (select professional_category::text from businesses where id = :'personal_workspace'),
  'LECTURER_TEACHER',
  'professional category is stored explicitly'
);
select is(
  (select organization_mode::text from businesses where id = :'personal_workspace'),
  'SCHOOL',
  'personal lecturer workspace reuses school attendance capabilities'
);
select is(
  (select institution_type from businesses where id = :'personal_workspace'),
  null,
  'personal workspace makes no institutional adoption claim'
);
select is(
  (select role::text from business_members where business_id = :'personal_workspace'),
  'owner',
  'professional owns the workspace through the existing membership system'
);

select school_manage(
  'faculty',
  jsonb_build_object('organization_id', :'personal_workspace', 'name', 'Independent teaching')
)->>'id' as personal_faculty \gset
select is(
  (select organization_id from faculties where id = :'personal_faculty'),
  :'personal_workspace'::uuid,
  'existing school authorization accepts the personal workspace owner'
);

select throws_ok(
  format(
    'update businesses set institution_type = ''UNIVERSITY'' where id = %L',
    :'personal_workspace'
  ),
  '23514',
  null,
  'an individual workspace cannot claim an institution type'
);

set local role authenticated;
select is((select count(*) from businesses), 2::bigint, 'member sees both authorized workspaces');
select throws_ok(
  $$update businesses set workspace_ownership = 'INDIVIDUAL'$$,
  '42501',
  null,
  'clients cannot rewrite workspace ownership'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"user_outsider","email":"lecturer@official-school.example","org_role":"owner","user_metadata":{"institution":"Official school"}}',
  true
);
set local role authenticated;
select is((select count(*) from businesses), 0::bigint, 'institution name, email domain and claims do not grant workspace access');
select is((select count(*) from business_members), 0::bigint, 'outsider cannot enumerate memberships');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_second_lecturer"}', true);
select onboard_professional_workspace(
  'Second lecturer workspace',
  'LECTURER_TEACHER',
  'GH',
  'Africa/Accra'
) as second_workspace \gset
set local role authenticated;
select is((select count(*) from businesses), 1::bigint, 'a second professional is isolated to their own workspace');
select is((select id from businesses), :'second_workspace'::uuid, 'RLS returns only the second professional workspace');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select onboard_professional_workspace('No identity', 'LECTURER_TEACHER', 'NG', 'Africa/Lagos')$$,
  '42501',
  'Authentication required',
  'professional onboarding fails closed without a Clerk subject'
);

select * from finish();
rollback;
