begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_schoolowner"}', true);
select onboard_organization('Matric identity school', 'education', 'NG', 'Africa/Lagos', 'Campus', 'Campus address', 'SCHOOL') as org \gset
select school_manage('faculty', jsonb_build_object('organization_id', :'org', 'name', 'Science'))->>'id' as faculty \gset
select school_manage('department', jsonb_build_object('organization_id', :'org', 'faculty_id', :'faculty', 'name', 'Computer Science'))->>'id' as department \gset
select school_manage('course', jsonb_build_object('organization_id', :'org', 'department_id', :'department', 'code', 'CSC101', 'title', 'Intro'))->>'id' as course \gset

set local role service_role;
select school_register_student(
  :'org', 'Ada Lovelace', '  csc/2022/045 ', :'faculty', :'department', '300', 'ada@matric.invalid', '08012345678', true,
  'reference/' || :'org' || '/11111111-1111-4111-8111-111111111111.jpg'
) as registered \gset
select is((:'registered')::jsonb->>'ok', 'true', 'first registration accepts the institution number');
select is((:'registered')::jsonb->>'matric_number', 'csc/2022/045', 'stored number keeps case, slashes and is only trimmed');
select is((select count(*)::text from school_profiles where organization_id = :'org'), '1', 'first registration creates one student');

select school_register_student(
  :'org', 'Someone Else', 'CSC / 2022 / 045', :'faculty', :'department', '300', 'other@matric.invalid', '08012345679', true,
  'reference/' || :'org' || '/22222222-2222-4222-8222-222222222222.jpg'
) as duplicate \gset
select is((:'duplicate')::jsonb->>'code', 'DUPLICATE', 'a repeated registration does not create another student');
select is((:'duplicate')::jsonb->>'matric_number', 'csc/2022/045', 'duplicate registration returns the original number');
select is((select count(*)::text from school_profiles where organization_id = :'org'), '1', 'duplicate registration does not insert a profile');
select is((select matric_number from school_profiles where id = ((:'registered')::jsonb->>'student_id')::uuid), 'csc/2022/045', 'original matriculation number is unchanged');

select school_register_student(
  :'org', 'Zero Student', '001234', :'faculty', :'department', '100', 'zero@matric.invalid', null, true,
  'reference/' || :'org' || '/33333333-3333-4333-8333-333333333333.jpg'
)->>'matric_number' as zeros \gset
select is(:'zeros', '001234', 'leading zeros are preserved');

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_schoolowner"}', true);
set local role authenticated;
select school_correct_student(:'org', jsonb_build_object(
  'student_id', ((:'registered')::jsonb->>'student_id'),
  'full_name', 'Ada Lovelace Byron',
  'matric_number', 'CSC/2022/045',
  'department_id', :'department',
  'level', '400',
  'phone', '08000000000'
)) as corrected \gset
select is((:'corrected')::jsonb->>'ok', 'true', 'an administrator can update a profile');
select is((select matric_number from school_profiles where id = ((:'registered')::jsonb->>'student_id')::uuid), 'csc/2022/045', 'a case-only edit does not replace the registered number');
select is((select full_name from people where id = ((:'registered')::jsonb->>'student_id')::uuid), 'Ada Lovelace Byron', 'name updates do not require a new matriculation number');
select is((select level from school_profiles where id = ((:'registered')::jsonb->>'student_id')::uuid), '400', 'academic level can change independently');
select school_correct_student(:'org', jsonb_build_object(
  'student_id', ((:'registered')::jsonb->>'student_id'),
  'full_name', 'Ada Lovelace Byron',
  'matric_number', 'csc/2022/099',
  'department_id', :'department',
  'level', '400'
)) as explicit \gset
select is((:'explicit')::jsonb->>'matric_number', 'csc/2022/099', 'an explicit correction stores the supplied institution number');
select is((select matric_number from school_profiles where id = ((:'registered')::jsonb->>'student_id')::uuid), 'csc/2022/099', 'the corrected number is not uppercased or regenerated');

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_schoolowner"}', true);
select throws_ok(
  format('update public.school_profiles set matric_number = %L where id = %L', 'AUTO/1', ((:'registered')::jsonb->>'student_id')),
  '22023',
  'Institution matriculation numbers cannot be replaced automatically',
  'ordinary updates cannot replace a matriculation number'
);

select school_import_roster(:'org', :'course', jsonb_build_array(jsonb_build_object('full_name', 'Ada Lovelace Byron', 'matric_number', 'CSC/2022/099'))) as imported \gset
select is((:'imported')::jsonb->>'added', '1', 'roster import enrolls the existing student');
select is((select count(*)::text from school_profiles where organization_id = :'org'), '2', 'import does not create a second profile');
select is((select matric_number from school_profiles where id = ((:'registered')::jsonb->>'student_id')::uuid), 'csc/2022/099', 'import does not rewrite the stored number');

select school_create_accountless_class(:'org', :'course', clock_timestamp() - interval '5 minutes', clock_timestamp() + interval '40 minutes', 10, clock_timestamp() + interval '20 minutes')->>'id' as class \gset
select school_manage('open', jsonb_build_object('organization_id', :'org', 'class_id', :'class'));
select gen_random_uuid() as nonce \gset
select school_issue_qr(:'class', :'nonce', clock_timestamp() + interval '30 seconds');
set local role service_role;
select is(
  school_attend_accountless(:'org', :'class', :'nonce', 'Ada Lovelace Byron', 'csc / 2022 / 099', repeat('a', 64), repeat('1', 64), gen_random_uuid())->>'status',
  'PRESENT',
  'returning attendance uses the existing student'
);
select is((select count(*)::text from school_profiles where organization_id = :'org'), '2', 'attendance does not create a replacement student');
select is((select matric_number from school_profiles where id = ((:'registered')::jsonb->>'student_id')::uuid), 'csc/2022/099', 'attendance leaves the matriculation number unchanged');
select is(
  (select submitted_matric_number from attendance_records where student_id = ((:'registered')::jsonb->>'student_id')::uuid),
  'csc/2022/099',
  'the attendance record stores the registered number'
);
select is(
  school_attend_accountless(:'org', :'class', :'nonce', 'New Person', 'brand/new/1', repeat('b', 64), repeat('2', 64), gen_random_uuid())->>'status',
  'NOT_REGISTERED',
  'an unknown number is rejected instead of being assigned'
);
select is((select count(*)::text from school_profiles where organization_id = :'org'), '2', 'rejected attendance does not insert a student');

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_schoolowner"}', true);
select onboard_organization('Second matric school', 'education', 'NG', 'Africa/Lagos', 'Campus', 'Campus address', 'SCHOOL') as other \gset
select school_manage('faculty', jsonb_build_object('organization_id', :'other', 'name', 'Science'))->>'id' as other_faculty \gset
select school_manage('department', jsonb_build_object('organization_id', :'other', 'faculty_id', :'other_faculty', 'name', 'Physics'))->>'id' as other_department \gset
set local role service_role;
select is(
  school_register_student(:'other', 'Other Ada', 'csc/2022/099', :'other_faculty', :'other_department', '200', 'ada@other.invalid', null, true, 'reference/' || :'other' || '/44444444-4444-4444-8444-444444444444.jpg')->>'ok',
  'true',
  'another institution can register the same matriculation number'
);

select * from finish();
rollback;
