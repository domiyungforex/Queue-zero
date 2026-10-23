begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_schoolowner"}',true);
select onboard_organization('Accountless school test','education','NG','Africa/Lagos','Campus','Campus address','SCHOOL') as org \gset
select school_manage('faculty',jsonb_build_object('organization_id',:'org','name','Science'))->>'id' as faculty \gset
select school_manage('department',jsonb_build_object('organization_id',:'org','faculty_id',:'faculty','name','Physics'))->>'id' as department \gset
select school_manage('course',jsonb_build_object('organization_id',:'org','department_id',:'department','code','PHY101','title','Mechanics'))->>'id' as course \gset
select school_manage('lecturer',jsonb_build_object('organization_id',:'org','course_id',:'course','user_id','user_teacher','display_name','Lecturer'));
select school_import_roster(:'org',:'course',jsonb_build_array(
 jsonb_build_object('full_name','Akinyele Dominion','matric_number','PHY/2026/0142'),
 jsonb_build_object('full_name','Mary Adewale','matric_number','PHY/2026/0188'),
 jsonb_build_object('full_name','Student Absent','matric_number','PHY/2026/0199')));
select is((school_roster_existing(:'org',:'course',array['phy /2026/0142','UNKNOWN'])->>'existing')::integer,1,'roster preview resolves normalized matric numbers');
select school_create_accountless_class(:'org',:'course',clock_timestamp()-interval '20 minutes',clock_timestamp()+interval '40 minutes',10,clock_timestamp()+interval '20 minutes')->>'id' as class \gset
select school_manage('open',jsonb_build_object('organization_id',:'org','class_id',:'class'));
select is((select count(*) from class_roster where class_session_id=:'class'),3::bigint,'opening freezes the official roster');

-- Lecturer assignment is delegated access, not an attendance prerequisite.
select school_manage('course',jsonb_build_object('organization_id',:'org','department_id',:'department','code','PHY102','title','Waves'))->>'id' as owner_course \gset
select school_create_accountless_class(:'org',:'owner_course',clock_timestamp()-interval '5 minutes',clock_timestamp()+interval '30 minutes',10,clock_timestamp()+interval '15 minutes')->>'id' as owner_class \gset
select school_manage('open',jsonb_build_object('organization_id',:'org','class_id',:'owner_class'));
select is((select status::text from sessions where id=:'owner_class'),'OPEN','workspace owner opens attendance without assigning a lecturer');

select gen_random_uuid() as nonce1,gen_random_uuid() as nonce2,gen_random_uuid() as request1 \gset
select school_issue_qr(:'class',:'nonce1',clock_timestamp()+interval '30 seconds') as issued \gset
select is((school_issue_qr(:'class',:'nonce2',clock_timestamp()+interval '30 seconds')->>'nonce'),(:'issued')::jsonb->>'nonce','class QR remains stable throughout its attendance window');
set local role service_role;
select is((school_public_class(:'org',:'class',:'nonce1')->>'course_code'),'PHY101','public QR resolves only safe class details');
select school_attend_accountless(:'org',:'class',:'nonce1','  AKINYELE   DOMINION ',' phy /2026/0142 ',repeat('a',64),repeat('1',64),:'request1') as first_result \gset
select is((:'first_result')::jsonb->>'status','LATE','server time determines late status');
select is((:'first_result')::jsonb->>'full_name','Akinyele Dominion','success returns canonical roster name');
select is(school_attend_accountless(:'org',:'class',:'nonce1','Akinyele Dominion','PHY/2026/0142',repeat('a',64),repeat('1',64),:'request1'),(:'first_result')::jsonb,'same request safely returns its committed result');
select is(school_attend_accountless(:'org',:'class',:'nonce1','Akinyele Dominion','PHY/2026/0142',repeat('a',64),repeat('1',64),gen_random_uuid())->>'status','DUPLICATE','new duplicate submission is rejected');
select is(school_attend_accountless(:'org',:'class',:'nonce1','Wrong Person','PHY/2026/0188',repeat('b',64),repeat('1',64),gen_random_uuid())->>'message','The name entered does not match the class record.','wrong name is rejected without disclosing the roster name');
select is(school_attend_accountless(:'org',:'class',:'nonce1','Unknown Student','NO/ROSTER/1',repeat('c',64),repeat('1',64),gen_random_uuid())->>'status','LATE','a student can attend without advance registration');
select is(school_attend_accountless(:'org',:'class',:'nonce1','Mary Adewale','PHY/2026/0188',repeat('a',64),repeat('1',64),gen_random_uuid())->>'status','LATE','a second roster student can attend from a shared device');
select school_attend_accountless(:'org',:'class',:'nonce2','Unknown Student','NO/RATE/1',repeat('e',64),repeat('2',64),gen_random_uuid()) from generate_series(1,10);
select is(school_attend_accountless(:'org',:'class',:'nonce1','Unknown Student','NO/RATE/1',repeat('e',64),repeat('2',64),gen_random_uuid())->>'status','RATE_LIMITED','matric and device attempts are rate limited without blocking a whole lecture hall IP');
reset role;
select is((select count(*) from attendance_records where class_session_id=:'class'),3::bigint,'one authoritative record exists per attending student');
select is((select count(*) from attendance_flags where class_session_id=:'class' and reason='POSSIBLE_PROXY_ATTENDANCE'),2::bigint,'shared device creates review flags without rejecting attendance');
select ok((select bool_and(check_in_at<=clock_timestamp() and check_in_at>clock_timestamp()-interval '1 minute') from attendance_records where class_session_id=:'class'),'attendance uses authoritative server timestamps');
select ok((select bool_and(metadata='{}'::jsonb) from presence_events where session_id=:'class'),'presence events do not expose names, matric numbers or device identifiers');

-- No enrollment may be created through an invalid or cross-workspace QR.
select count(*) as profiles_before from school_profiles where organization_id=:'org' \gset
set local role service_role;
select is(school_attend_accountless(:'org',:'class',gen_random_uuid(),'Invalid QR Student','INVALID/QR',repeat('f',64),repeat('3',64),gen_random_uuid())->>'status','CLOSED','invalid QR cannot register a student');
select throws_ok(format('select school_attend_accountless(%L,%L,%L,NULL,''NULL/NAME'',repeat(''f'',64),repeat(''3'',64),gen_random_uuid())',:'org',:'class',:'nonce1'),'22023','Invalid attendance request','null names rejected at database boundary');
select throws_ok(format('select school_attend_accountless(%L,%L,%L,''Cross tenant'',''CROSS'',repeat(''f'',64),repeat(''3'',64),gen_random_uuid())',gen_random_uuid(),:'class',:'nonce1'),'42501','Class unavailable','signed tenant context must match the class');
select is(school_attend_accountless(:'org',:'class',:'nonce1','Wrong Name','PHY/2026/0142',repeat('f',64),repeat('3',64),:'request1')->>'status','NAME_MISMATCH','replaying request with a different name does not disclose stored success');
reset role;
select is((select count(*) from school_profiles where organization_id=:'org'),:'profiles_before'::bigint,'rejected submissions do not create student identities');
select is((select count(*) from course_students cs join school_profiles sp on sp.id=cs.student_id where cs.course_id=:'course' and sp.matric_number='NO/ROSTER/1'),1::bigint,'new attendee belongs to the existing course');
select is((select count(*) from class_roster r join school_profiles sp on sp.id=r.student_id where r.class_session_id=:'class' and sp.matric_number='NO/ROSTER/1'),1::bigint,'new attendee appears in the existing class register');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_teacher"}',true);
set local role authenticated;
select ok(queuezero_receive_topic('class:'||:'class'),'assigned lecturer can receive class realtime invalidations');
select throws_ok(format('select school_attend_accountless(%L,%L,%L,''Akinyele Dominion'',''PHY/2026/0142'',repeat(''a'',64),repeat(''1'',64),gen_random_uuid())',:'org',:'class',:'nonce1'),'42501','permission denied for function school_attend_accountless','browser database clients cannot invoke the privileged attendance mutation');
select is((select count(*) from attendance_records),3::bigint,'lecturer sees the authorized class register');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_schoolowner"}',true);
select school_manage('close_arrival',jsonb_build_object('organization_id',:'org','class_id',:'class'));
set local role service_role;
select is(school_attend_accountless(:'org',:'class',:'nonce1','Student Absent','PHY/2026/0199',repeat('d',64),repeat('1',64),gen_random_uuid())->>'status','CLOSED','closed attendance rejects the class QR');
select is(school_attend_accountless(:'org',:'class',:'nonce1','New Closed Student','CLOSED/NEW',repeat('d',64),repeat('1',64),gen_random_uuid())->>'status','CLOSED','closed attendance cannot self-register a student');
reset role;
select is((select count(*) from school_profiles where organization_id=:'org' and matric_number='CLOSED/NEW'),0::bigint,'closed submission leaves no student record');
select school_revoke_qr(:'org',:'class');
select throws_ok(format('select school_issue_qr(%L,gen_random_uuid(),clock_timestamp()+interval ''30 seconds'')',:'class'),'22023','Attendance is closed','revoked QR cannot be reissued');
select school_manage('finish',jsonb_build_object('organization_id',:'org','class_id',:'class'));
select is((select count(*) from attendance_records where class_session_id=:'class' and status='ABSENT'),1::bigint,'ending class records roster absences');
select is(jsonb_array_length(school_snapshot(:'org',null,:'class')->'attendance'),4,'official register includes imported students and students who joined');

select * from finish();
rollback;
