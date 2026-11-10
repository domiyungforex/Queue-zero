begin;

-- Attendance policy is scoped to each class. Existing classes keep the safe
-- roster-checked behavior; newly created classes default to STANDARD.
alter table public.class_sessions
  add column if not exists verification_mode text not null default 'VERIFIED'
  check (verification_mode in ('STANDARD','VERIFIED'));

create or replace function public.school_create_accountless_class(
 p_organization_id uuid,p_course_id uuid,p_starts_at timestamptz,p_planned_ends_at timestamptz,
 p_late_after_minutes integer,p_attendance_closes_at timestamptz,
 p_verification_mode text default 'STANDARD'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result_id uuid; actor text:=private.current_clerk_user_id();
begin
 if private.school_lock_course(p_course_id) is distinct from p_organization_id then raise exception 'Course unavailable' using errcode='42501'; end if;
 if p_verification_mode not in ('STANDARD','VERIFIED') then raise exception 'Choose a valid attendance mode' using errcode='22023'; end if;
 if p_starts_at is null or not isfinite(p_starts_at) or p_late_after_minutes not between 0 and 120
    or p_attendance_closes_at is null or not isfinite(p_attendance_closes_at) or p_attendance_closes_at<=p_starts_at
    or p_attendance_closes_at>p_starts_at+interval '6 hours'
    or (p_planned_ends_at is not null and (not isfinite(p_planned_ends_at) or p_planned_ends_at<=p_starts_at or p_attendance_closes_at>p_planned_ends_at)) then
  raise exception 'Invalid class attendance window' using errcode='22023';
 end if;
 insert into public.sessions(organization_id,type,status,starts_at,created_by) values(p_organization_id,'CLASS','DRAFT',p_starts_at,actor) returning id into result_id;
 insert into public.class_sessions(id,organization_id,course_id,late_after_minutes,departure_required,planned_ends_at,attendance_closes_at,verification_mode)
 values(result_id,p_organization_id,p_course_id,p_late_after_minutes,false,p_planned_ends_at,p_attendance_closes_at,p_verification_mode);
 insert into public.business_events(business_id,type,actor_user_id,metadata)
 values(p_organization_id,'school_class',actor,jsonb_build_object('id',result_id,'verification_mode',p_verification_mode));
 perform private.school_broadcast(p_organization_id,result_id);
 return jsonb_build_object('id',result_id,'message','Class created.');
end $$;

-- Preserve the old RPC signature for callers that have not yet upgraded.
create or replace function public.school_create_accountless_class(
 p_organization_id uuid,p_course_id uuid,p_starts_at timestamptz,p_planned_ends_at timestamptz,
 p_late_after_minutes integer,p_attendance_closes_at timestamptz
) returns jsonb language sql security definer set search_path='' as $$
 select public.school_create_accountless_class(p_organization_id,p_course_id,p_starts_at,p_planned_ends_at,p_late_after_minutes,p_attendance_closes_at,'STANDARD');
$$;

create or replace function public.school_public_class(p_organization_id uuid,p_class_id uuid,p_nonce uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'organization_name',b.name,'course_code',c.code,'course_title',c.title,
  'starts_at',s.starts_at,'planned_ends_at',cs.planned_ends_at,
  'attendance_closes_at',cs.attendance_closes_at,'verification_mode',cs.verification_mode,
  'open',(s.status='OPEN' and cs.arrival_open and cs.qr_revoked_at is null and (cs.attendance_closes_at is null or cs.attendance_closes_at>clock_timestamp()))
 )
 from public.class_sessions cs
 join public.sessions s on s.id=cs.id
 join public.courses c on c.id=cs.course_id
 join public.businesses b on b.id=cs.organization_id
 join public.attendance_qr_nonces q on q.class_session_id=cs.id
 where cs.id=p_class_id and cs.organization_id=p_organization_id and q.nonce=p_nonce;
$$;

-- Standard mode creates a minimal student profile on first valid submission.
-- Verified mode only accepts a student frozen into the class roster.
create or replace function public.school_attend_accountless(
 p_organization_id uuid,p_class_id uuid,p_nonce uuid,p_full_name text,p_matric_number text,
 p_device_hash text,p_network_hash text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 cls public.class_sessions%rowtype;
 person uuid;
 canonical_name text;
 canonical_matric text;
 now_at timestamptz:=clock_timestamp();
 st public.attendance_status;
 result jsonb;
 prior public.attendance_scan_requests%rowtype;
 matric_key text;
 outcome text;
 risk text[]:='{}';
 shared uuid;
 clean_name text:=btrim(p_full_name);
 clean_matric text:=upper(btrim(p_matric_number));
begin
 if p_request_id is null or p_nonce is null or p_device_hash is null or p_network_hash is null or length(clean_name) not between 1 and 160
    or length(clean_matric) not between 1 and 80
    or p_device_hash !~ '^[0-9a-f]{64}$' or p_network_hash !~ '^[0-9a-f]{64}$'
 then raise exception 'Invalid attendance request' using errcode='22023'; end if;

 select cs.* into cls from public.class_sessions cs
 where cs.id=p_class_id and cs.organization_id=p_organization_id;
 if not found then raise exception 'Class unavailable' using errcode='42501'; end if;

 matric_key:=encode(extensions.digest(convert_to(p_organization_id::text||':'||private.normalized_matric(clean_matric),'UTF8'),'sha256'),'hex');
 select r.* into prior from public.attendance_scan_requests r
 join public.school_profiles sp on sp.id=r.student_id
 where r.class_session_id=p_class_id and r.request_id=p_request_id and r.nonce=p_nonce
 and private.normalized_matric(sp.matric_number)=private.normalized_matric(clean_matric);
 if found then return prior.result; end if;

 if (select count(*) from public.attendance_submission_limits where class_session_id=p_class_id and device_hash=p_device_hash and created_at>now_at-interval '10 minutes')>=20
    or (select count(*) from public.attendance_submission_limits where class_session_id=p_class_id and matric_hash=matric_key and created_at>now_at-interval '10 minutes')>=10
    or (select count(*) from public.attendance_submission_limits where class_session_id=p_class_id and network_hash=p_network_hash and created_at>now_at-interval '10 minutes')>=300 then
  insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome)
  values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'RATE_LIMITED');
  return jsonb_build_object('ok',false,'status','RATE_LIMITED','message','Too many attempts. Wait a moment or ask your lecturer for help.');
 end if;

 if not exists(select 1 from public.attendance_qr_nonces where nonce=p_nonce and organization_id=p_organization_id and class_session_id=p_class_id and expires_at>now_at)
    or cls.qr_revoked_at is not null or not cls.arrival_open
    or not exists(select 1 from public.sessions where id=p_class_id and status='OPEN')
    or (cls.attendance_closes_at is not null and cls.attendance_closes_at<=now_at) then
  insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome)
  values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'CLOSED');
  return jsonb_build_object('ok',false,'status','CLOSED','message','Attendance for this class is closed.');
 end if;

 if cls.verification_mode='VERIFIED' then
  select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric
  from public.class_roster r
  join public.school_profiles sp on sp.id=r.student_id
  join public.people p on p.id=r.student_id
  where r.class_session_id=p_class_id
    and private.normalized_matric(sp.matric_number)=private.normalized_matric(clean_matric);
  if person is null then
   insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome)
   values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'NOT_REGISTERED');
   return jsonb_build_object('ok',false,'status','NOT_REGISTERED','message','Student not found in this course roster. Please contact your lecturer.');
  end if;
  if private.normalized_student_name(canonical_name)<>private.normalized_student_name(clean_name) then
   return jsonb_build_object('ok',false,'status','NAME_MISMATCH','message','The name entered does not match the official course roster.');
  end if;
 else
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||private.normalized_matric(clean_matric),2));
  select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric
  from public.people p join public.school_profiles sp on sp.id=p.id and sp.organization_id=p.organization_id
  where p.organization_id=p_organization_id and p.type='STUDENT'
    and private.normalized_matric(sp.matric_number)=private.normalized_matric(clean_matric)
  for update of p,sp;
  if person is null then
   select department_id into person from public.courses where id=cls.course_id and organization_id=p_organization_id;
   if person is null then raise exception 'Course unavailable' using errcode='42501'; end if;
   insert into public.people(organization_id,type,full_name)
   values(p_organization_id,'STUDENT',clean_name) returning id into person;
   insert into public.school_profiles(id,organization_id,department_id,matric_number,level)
   select person,p_organization_id,c.department_id,clean_matric,'UNSPECIFIED'
   from public.courses c where c.id=cls.course_id and c.organization_id=p_organization_id;
   canonical_name:=clean_name; canonical_matric:=clean_matric;
  elsif private.normalized_student_name(canonical_name)<>private.normalized_student_name(clean_name) then
   return jsonb_build_object('ok',false,'status','IDENTITY_MISMATCH','message','That matric number is already associated with a different name. Please check your details.');
  end if;
  insert into public.course_students(organization_id,course_id,student_id)
  values(p_organization_id,cls.course_id,person) on conflict do nothing;
  insert into public.class_roster(organization_id,class_session_id,student_id)
  values(p_organization_id,p_class_id,person) on conflict do nothing;
 end if;

 perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||person::text,0));
 select * into prior from public.attendance_scan_requests where class_session_id=p_class_id and student_id=person and request_id=p_request_id;
 if found then return prior.result; end if;

 if exists(select 1 from public.attendance_records where class_session_id=p_class_id and student_id=person) then
  result:=jsonb_build_object('ok',false,'status','DUPLICATE','message','Already recorded. Your attendance cannot be submitted twice.');
  outcome:='DUPLICATE';
 else
  if cls.verification_mode='VERIFIED' then
   if exists(select 1 from public.attendance_device_uses where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person) then risk:=array_append(risk,'POSSIBLE_PROXY_ATTENDANCE'); end if;
  end if;
  now_at:=clock_timestamp();
  st:=case when now_at>(select starts_at from public.sessions where id=p_class_id)+make_interval(mins=>cls.late_after_minutes)
    then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status end;
  insert into public.attendance_records(organization_id,class_session_id,student_id,check_in_at,status,submitted_name,submitted_matric_number,risk_flags,flag_reason)
  values(p_organization_id,p_class_id,person,now_at,st,canonical_name,canonical_matric,risk,case when cardinality(risk)>0 then array_to_string(risk,',') end);
  insert into public.registered_devices(organization_id,student_id,device_hash)
  values(p_organization_id,person,p_device_hash) on conflict(organization_id,student_id,device_hash) do update set last_seen_at=now_at;
  insert into public.attendance_device_uses(organization_id,class_session_id,student_id,device_hash)
  values(p_organization_id,p_class_id,person,p_device_hash) on conflict do nothing;
  if cardinality(risk)>0 then
   for shared in select distinct student_id from public.attendance_device_uses
    where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person loop
    insert into public.attendance_flags(organization_id,class_session_id,student_id,reason)
    values(p_organization_id,p_class_id,person,'POSSIBLE_PROXY_ATTENDANCE'),
          (p_organization_id,p_class_id,shared,'POSSIBLE_PROXY_ATTENDANCE') on conflict do nothing;
   end loop;
  end if;
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id)
  values(p_organization_id,p_class_id,person,'CHECKED_IN','student',person::text),
        (p_organization_id,p_class_id,person,'ARRIVED','student',person::text);
  result:=jsonb_build_object('ok',true,'status',st,'message','Attendance recorded!','full_name',canonical_name,
    'matric_number',canonical_matric,'course_code',(select c.code from public.courses c where c.id=cls.course_id),
    'recorded_at',now_at,'needs_review',cardinality(risk)>0,
    'identity_status',case when cls.verification_mode='VERIFIED' then 'STUDENT_FOUND' else 'STANDARD' end);
  outcome:='ACCEPTED';
 end if;
 insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,result)
 values(p_organization_id,p_class_id,person,p_request_id,p_nonce,result);
 insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome)
 values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,outcome);
 perform private.school_broadcast(p_organization_id,p_class_id);
 return result;
end $$;

-- Snapshot carries the mode to staff dashboards without exposing private tokens.
create or replace function public.school_snapshot(p_organization_id uuid,p_course_id uuid default null,p_class_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; course_filter uuid:=p_course_id;
begin
 if not private.school_staff(p_organization_id) then raise exception 'School unavailable' using errcode='42501'; end if;
 if p_class_id is not null then
  select course_id into course_filter from public.class_sessions where id=p_class_id and organization_id=p_organization_id;
  if course_filter is null or not private.school_class_access(p_class_id) or (p_course_id is not null and p_course_id<>course_filter) then raise exception 'Class unavailable' using errcode='42501'; end if;
 end if;
 if course_filter is not null and not exists(select 1 from public.courses where id=course_filter and organization_id=p_organization_id and private.school_course_access(id)) then raise exception 'Course unavailable' using errcode='42501'; end if;
 with allowed_courses as (select * from public.courses c where c.organization_id=p_organization_id and private.school_course_access(c.id) and (course_filter is null or c.id=course_filter)),
 allowed_classes as (select c.*,s.status,s.starts_at,s.ends_at from public.class_sessions c join public.sessions s on s.id=c.id where c.course_id in(select id from allowed_courses) and (p_class_id is null or c.id=p_class_id)),
 roster as (select e.course_id,e.student_id from public.course_students e where e.course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT'))
 union select c.course_id,r.student_id from public.class_roster r join allowed_classes c on c.id=r.class_session_id where p_class_id is not null)
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name,'mode',organization_mode,'timezone',timezone) from public.businesses where id=p_organization_id),
 'faculties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.faculties where organization_id=p_organization_id),'[]'),
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'faculty_id',faculty_id,'name',name) order by name) from public.departments where organization_id=p_organization_id),'[]'),
 'courses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'department_id',department_id,'code',code,'title',title) order by code) from allowed_courses),'[]'),
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'matric_number',sp.matric_number,'department_id',sp.department_id,'level',sp.level) order by p.full_name) from public.people p join public.school_profiles sp on sp.id=p.id where p.id in(select student_id from roster)),'[]'),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(r)) from roster r),'[]'),
 'lecturers',coalesce((select jsonb_agg(jsonb_build_object('course_id',l.course_id,'clerk_user_id',l.clerk_user_id,'display_name',l.display_name)) from (select course_id,clerk_user_id,display_name from public.course_lecturers where course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT')) union all select c.course_id,l.clerk_user_id,l.display_name from public.class_lecturers l join allowed_classes c on c.id=l.class_session_id where p_class_id is not null) l),'[]'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'course_id',course_id,'status',status,'starts_at',starts_at,'ends_at',ends_at,'late_after_minutes',late_after_minutes,'checkout_enabled',checkout_enabled,'arrival_open',arrival_open,'departure_required',departure_required,'planned_ends_at',planned_ends_at,'verification_mode',verification_mode) order by starts_at desc) from allowed_classes),'[]'),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'check_in_at',check_in_at,'check_out_at',check_out_at,'status',status,'flag_reason',flag_reason)) from public.attendance_records where class_session_id in(select id from allowed_classes)),'[]'),
 'flags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'reason',reason,'created_at',created_at,'resolved_at',resolved_at,'resolution',resolution)) from public.attendance_flags where class_session_id in(select id from allowed_classes)),'[]')
 ) into result;
 return result;
end $$;

revoke all on function public.school_create_accountless_class(uuid,uuid,timestamptz,timestamptz,integer,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.school_create_accountless_class(uuid,uuid,timestamptz,timestamptz,integer,timestamptz,text) to authenticated;
revoke all on function public.school_create_accountless_class(uuid,uuid,timestamptz,timestamptz,integer,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.school_create_accountless_class(uuid,uuid,timestamptz,timestamptz,integer,timestamptz) to authenticated;
revoke all on function public.school_public_class(uuid,uuid,uuid),public.school_attend_accountless(uuid,uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.school_public_class(uuid,uuid,uuid),public.school_attend_accountless(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;
revoke all on function public.school_snapshot(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.school_snapshot(uuid,uuid,uuid) to authenticated;

commit;
