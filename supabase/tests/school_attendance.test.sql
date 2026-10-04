begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_schoolowner"}',true);
select onboard_organization('Actual school test','education','NG','Africa/Lagos','Campus','Campus address','SCHOOL') as org \gset
select is((select organization_mode::text from businesses where id=:'org'),'SCHOOL','organization mode is additive');
select school_manage('faculty',jsonb_build_object('organization_id',:'org','name','Science'))->>'id' as faculty \gset
select school_manage('department',jsonb_build_object('organization_id',:'org','faculty_id',:'faculty','name','Physics'))->>'id' as department \gset
select school_manage('course',jsonb_build_object('organization_id',:'org','department_id',:'department','code','PHY101','title','Mechanics'))->>'id' as course \gset
select school_manage('course',jsonb_build_object('organization_id',:'org','department_id',:'department','code','PHY102','title','Waves'))->>'id' as other_course \gset
select school_manage('lecturer',jsonb_build_object('organization_id',:'org','course_id',:'course','user_id','user_teacher','display_name','Lecturer'));
select school_manage('enroll',jsonb_build_object('organization_id',:'org','course_id',:'course','students',jsonb_build_array(
 jsonb_build_object('full_name','Student One','email','one@school.test','matric_number','PHY1','department_id',:'department','level','100'),
 jsonb_build_object('full_name','Student Two','email','two@school.test','matric_number','PHY2','department_id',:'department','level','100'),
 jsonb_build_object('full_name','Student Three','email','three@school.test','matric_number','PHY3','department_id',:'department','level','100'))));
select school_manage('class',jsonb_build_object('organization_id',:'org','course_id',:'course','starts_at',clock_timestamp()-interval '20 minutes','late_after_minutes',10,'departure_required',true))->>'id' as class \gset
select is((select count(*) from sessions where id=:'class' and type='CLASS'),1::bigint,'class is backed by a shared session');
select school_manage('open',jsonb_build_object('organization_id',:'org','class_id',:'class'));
select is((select count(*) from class_roster where class_session_id=:'class'),3::bigint,'expected register is frozen at open');
select gen_random_uuid() as nonce1,gen_random_uuid() as nonce2,gen_random_uuid() as nonce3,gen_random_uuid() as request1 \gset
select school_issue_qr(:'class',:'nonce1',clock_timestamp()+interval '30 seconds');
select throws_ok(format('select school_issue_qr(%L,%L,clock_timestamp()+interval ''60 seconds'')',:'class',gen_random_uuid()),'22023','Invalid QR validity','long-lived tokens cannot be issued');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_teacher"}',true);
set local role authenticated;
select is(jsonb_array_length(school_snapshot(:'org',null,null)->'courses'),1,'lecturer sees only assigned courses');
select throws_ok(format('select school_snapshot(%L,%L,null)',:'org',:'other_course'),'42501','Course unavailable','cross-course snapshot denied');
select ok(queuezero_receive_topic('class:'||:'class'),'assigned lecturer can receive class invalidations');
select throws_ok(format('select school_manage(''faculty'',jsonb_build_object(''organization_id'',%L,''name'',''Unauthorized''))',:'org'),'42501','Manager required','lecturer cannot administer school');
select throws_ok(format('select school_scan(%L,%L,%L,''user_s1'',repeat(''a'',64),gen_random_uuid())',:'org',:'class',:'nonce1'),'42501',null,'authenticated users cannot impersonate students through scan RPC');
reset role;
set local role service_role;
select school_claim_student(:'org','user_s1','one@school.test')->>'id' as student1 \gset
select school_claim_student(:'org','user_s2','two@school.test')->>'id' as student2 \gset
select throws_ok(format('select school_claim_student(%L,''user_impersonator'',''one@school.test'')',:'org'),'42501','Enrollment unavailable','claimed enrollment cannot be stolen');
select school_scan(:'org',:'class',:'nonce1','user_s1',repeat('a',64),:'request1') as first_result \gset
select is((:'first_result')::jsonb->>'action','CHECK_IN','first valid scan checks in');
select is((:'first_result')::jsonb->>'status','LATE','server time determines lateness');
select is(school_scan(:'org',:'class',:'nonce1','user_s1',repeat('a',64),:'request1'),(:'first_result')::jsonb,'ambiguous retry returns exact prior result');
select is(school_scan(:'org',:'class',:'nonce1','user_s1',repeat('a',64),gen_random_uuid())->>'status','DUPLICATE_SCAN','same token cannot turn an accidental second scan into checkout');
select is(school_scan(:'org',:'class',:'nonce1','user_s2',repeat('a',64),gen_random_uuid())->>'action','CHECK_IN','class QR legitimately serves multiple students');
select throws_ok(format('select school_scan(%L,%L,%L,''user_s1'',repeat(''a'',64),gen_random_uuid())',gen_random_uuid(),:'class',:'nonce1'),'42501','Class unavailable','cross-organization scan denied');
reset role;
select is((select count(*) from attendance_flags where class_session_id=:'class' and reason='POSSIBLE_PROXY_ATTENDANCE'),2::bigint,'shared device flags both identities without punishing either');
select is((select count(*) from attendance_records where class_session_id=:'class'),2::bigint,'simulated client state cannot duplicate official records');
select ok((select bool_and(check_in_at<=clock_timestamp() and check_in_at>clock_timestamp()-interval '1 minute') from attendance_records where class_session_id=:'class'),'arrival timestamps come from server');
select ok((select bool_and(metadata='{}'::jsonb or metadata='{"reason":"POSSIBLE_PROXY_ATTENDANCE"}'::jsonb) from presence_events where session_id=:'class'),'presence metadata contains no names, emails, matric numbers or device identifiers');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_schoolowner"}',true);
select school_issue_qr(:'class',:'nonce2',clock_timestamp()+interval '30 seconds');
set local role service_role;
select is(school_scan(:'org',:'class',:'nonce2','user_s1',repeat('a',64),gen_random_uuid())->>'status','CHECKOUT_CLOSED','departure requires lecturer to open checkout');
reset role;
select school_manage('close_arrival',jsonb_build_object('organization_id',:'org','class_id',:'class'));
select school_manage('enable_checkout',jsonb_build_object('organization_id',:'org','class_id',:'class'));
select school_issue_qr(:'class',:'nonce3',clock_timestamp()+interval '30 seconds');
set local role service_role;
select is(school_scan(:'org',:'class',:'nonce3','user_s1',repeat('a',64),gen_random_uuid())->>'action','CHECK_OUT','second valid scan during departure checks out');
reset role;
select gen_random_uuid() as nonce4 \gset
select school_issue_qr(:'class',:'nonce4',clock_timestamp()+interval '30 seconds');
set local role service_role;
select is(school_scan(:'org',:'class',:'nonce4','user_s1',repeat('a',64),gen_random_uuid())->>'status','THIRD_SCAN','third valid scan is blocked and reviewed');
reset role;
select is((select count(*) from attendance_flags where student_id=:'student1' and reason='THIRD_SCAN'),1::bigint,'third scan creates review flag');
update attendance_qr_nonces set expires_at=clock_timestamp()-interval '1 second' where nonce=:'nonce4';
set local role service_role;
select is(school_scan(:'org',:'class',:'nonce4','user_s2',repeat('b',64),gen_random_uuid())->>'status','INVALID_QR','expired QR rejected by authoritative database');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_s1"}',true);
set local role authenticated;
select is((select count(*) from attendance_records),0::bigint,'students cannot enumerate register');
select is((select count(*) from people),1::bigint,'students can see only their own identity');
select ok(not queuezero_receive_topic('class:'||:'class') and not queuezero_receive_topic('school:'||:'org'),'student cannot subscribe to lecturer topics');
select throws_ok(format('select school_snapshot(%L,null,%L)',:'org',:'class'),'42501','School unavailable','student cannot export an official register');
select throws_ok(format('select school_issue_qr(%L,gen_random_uuid(),clock_timestamp()+interval ''30 seconds'')',:'class'),'42501','Course unavailable','student cannot mint QR');
select throws_ok(format('select set_organization_mode(%L,''BUSINESS'')',:'org'),'42501','Not authorized','student cannot escalate organization capabilities');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_schoolowner"}',true);
select school_manage('finish',jsonb_build_object('organization_id',:'org','class_id',:'class'));
select is((select count(*) from attendance_records where class_session_id=:'class' and status='ABSENT'),1::bigint,'ending class records enrolled absences');
select is((select status::text from attendance_records where class_session_id=:'class' and student_id=:'student2'),'INCOMPLETE','required missing departure is incomplete');
select is(jsonb_array_length(school_snapshot(:'org',null,:'class')->'attendance'),3,'official register includes all expected students');
select throws_ok(format('select school_manage(''open'',jsonb_build_object(''organization_id'',%L,''class_id'',%L))',:'org',:'class'),'22023','Class cannot be reopened','completed class cannot be reopened');
select school_manage('remove_lecturer',jsonb_build_object('organization_id',:'org','course_id',:'course','user_id','user_teacher'));
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_teacher"}',true);
select ok(not queuezero_receive_topic('class:'||:'class'),'revoked lecturer loses live topic permission');
select throws_ok(format('select school_snapshot(%L,null,%L)',:'org',:'class'),'42501','Class unavailable','revoked lecturer cannot export');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_schoolowner"}',true);
select is(jsonb_array_length(school_snapshot(:'org',null,:'class')->'lecturers'),1,'official register retains lecturer after assignment revoked');
select throws_ok(format('select school_manage(''class'',jsonb_build_object(''organization_id'',%L,''course_id'',%L,''starts_at'',''infinity''))',:'org',:'course'),'22023','Class start is required','infinite class timestamps rejected at database boundary');
select throws_ok(format('select school_manage(''resolve_flag'',jsonb_build_object(''organization_id'',%L,''flag_id'',(select id from attendance_flags where class_session_id=%L limit 1)))',:'org',:'class'),'22023','Resolution required','flag resolution cannot omit a rationale');
select throws_ok(format('select save_staff(%L,''user_newstudent'',''student'',array[]::uuid[],false)',:'org'),'22023','Invalid member','legacy staff management cannot grant new school roles');
set local role service_role;
select is(school_replay(:'org',:'class',:'nonce1','user_s1',:'request1'),(:'first_result')::jsonb,'expired retry can retrieve exact committed result without another scan');
select is(school_replay(:'org',:'class',:'nonce1','user_s2',:'request1'),null::jsonb,'replay result cannot be read by another student');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_teacher"}',true);
select school_manage('course',jsonb_build_object('organization_id',:'org','department_id',:'department','code','PHY103','title','Lab','creator_display_name','Lecturer'))->>'id' as own_course \gset
select ok(private.school_course_access(:'own_course'),'lecturer can create a course and receives only that assignment');
select * from finish();
rollback;
