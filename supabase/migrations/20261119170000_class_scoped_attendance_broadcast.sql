-- Attendance commits notify only the class channel.
-- Organization and business dashboards keep their slower poll and still receive
-- broadcasts from class setup and other school changes.
-- Does not rewrite rows. Do not apply to production without explicit authorization.

begin;

create or replace function private.school_broadcast_class(p_org uuid, p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_class is null then
    return;
  end if;
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    execute 'select realtime.send($1,$2,$3,true)' using '{"changed":true}'::jsonb, 'changed', 'class:' || p_class;
  end if;
end
$$;

revoke all on function private.school_broadcast_class(uuid, uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.school_attend_accountless(p_organization_id uuid, p_class_id uuid, p_nonce uuid, p_full_name text, p_matric_number text, p_device_hash text, p_network_hash text, p_request_id uuid, p_photo_url text DEFAULT NULL::text, p_location_lat double precision DEFAULT NULL::double precision, p_location_lng double precision DEFAULT NULL::double precision, p_location_accuracy_meters double precision DEFAULT NULL::double precision, p_location_captured_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 loc jsonb;
 loc_verified boolean:=false;
 captured_at timestamptz;
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

 loc := private.school_location_assessment(cls.location_lat, cls.location_lng, cls.geofence_radius_meters, p_location_lat, p_location_lng, p_location_accuracy_meters);
 if cls.location_lat is not null and cls.location_lng is not null and (loc->>'status') is distinct from 'WITHIN_RADIUS' then
  return jsonb_build_object('ok',false,'status',loc->>'status','message',loc->>'message','location_verified',false);
 end if;
 loc_verified := coalesce((loc->>'verified')::boolean, false);
 captured_at := case
  when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED')
    and p_location_captured_at is not null
    and p_location_captured_at <= clock_timestamp() + interval '2 minutes'
    and p_location_captured_at >= clock_timestamp() - interval '15 minutes'
  then p_location_captured_at else clock_timestamp()
 end;

 if cls.verification_mode='VERIFIED' then
  select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric
  from public.class_roster r
  join public.school_profiles sp on sp.id=r.student_id
  join public.people p on p.id=r.student_id
  where r.class_session_id=p_class_id
    and private.normalized_matric(sp.matric_number)=private.normalized_matric(clean_matric);

  if person is null then
   select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric
   from public.course_students cs
   join public.school_profiles sp on sp.id=cs.student_id
   join public.people p on p.id=cs.student_id
   where cs.course_id=cls.course_id and cs.organization_id=p_organization_id
     and private.normalized_matric(sp.matric_number)=private.normalized_matric(clean_matric);
  end if;

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

 -- Atomic duplicate prevention
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

  insert into public.attendance_records(
   organization_id,class_session_id,student_id,check_in_at,status,
   submitted_name,submitted_matric_number,risk_flags,flag_reason,
   photo_url,location_lat,location_lng,location_accuracy_meters,location_verified,location_captured_at,location_distance_meters,location_status,verification_mode
  ) values(
   p_organization_id,p_class_id,person,now_at,st,
   canonical_name,canonical_matric,risk,case when cardinality(risk)>0 then array_to_string(risk,',') end,
   p_photo_url,
   case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_lat else null end,
   case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_lng else null end,
   case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_accuracy_meters else null end,
   loc_verified,
   case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then captured_at else null end,
   (loc->>'distance_meters')::double precision,
   loc->>'status',
   cls.verification_mode
  );

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

  result:=jsonb_build_object(
    'ok',true,'status',st,'message','Attendance recorded. '||coalesce(loc->>'message', case when cls.location_lat is null then 'Location was not required for this session.' else '' end),
    'full_name',canonical_name,'matric_number',canonical_matric,
    'course_code',(select c.code from public.courses c where c.id=cls.course_id),
    'photo_url',p_photo_url,
    'recorded_at',now_at,'needs_review',cardinality(risk)>0,
    'identity_status',case when cls.verification_mode='VERIFIED' then 'STUDENT_FOUND' else 'STANDARD' end,
    'location_verified',loc_verified,
    'location_status',loc->>'status'
  );
  outcome:='ACCEPTED';
 end if;

 insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,result)
 values(p_organization_id,p_class_id,person,p_request_id,p_nonce,result);
 insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome)
 values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,outcome);
 perform private.school_broadcast_class(p_organization_id,p_class_id);
 return result;
end $function$;

create or replace function public.school_record_identified_attendance(
  p_organization_id uuid,
  p_student_id uuid,
  p_class_id uuid,
  p_photo_path text,
  p_method text,
  p_device_hash text,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_location_accuracy_meters double precision default null,
  p_location_captured_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cls public.class_sessions%rowtype;
  now_at timestamptz := clock_timestamp();
  st public.attendance_status;
  existing timestamptz;
  method text := case when p_method = 'MANUAL_DECLARED' then 'MANUAL_DECLARED' else 'LIVE_PHOTO' end;
  status_label text;
  loc jsonb;
  captured_at timestamptz;
begin
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'message', 'This device could not be verified. Reload and try again.');
  end if;
  if method = 'LIVE_PHOTO' and (p_photo_path is null or p_photo_path !~ ('^checks/' || p_organization_id::text || '/' || p_class_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')) then
    return jsonb_build_object('ok', false, 'message', 'The live photograph was not stored. Attendance was not recorded.');
  end if;

  select * into cls from public.class_sessions where id = p_class_id and organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'That attendance session is not available.');
  end if;
  if not exists (
    select 1 from public.sessions s
    where s.id = cls.id and s.status = 'OPEN'
  ) or not cls.arrival_open or cls.qr_revoked_at is not null
    or (cls.attendance_closes_at is not null and cls.attendance_closes_at <= now_at) then
    return jsonb_build_object('ok', false, 'message', 'Attendance for this session is closed.');
  end if;
  if not exists (
    select 1 from public.class_roster r
    where r.class_session_id = cls.id and r.student_id = p_student_id and r.organization_id = p_organization_id
  ) then
    return jsonb_build_object('ok', false, 'message', 'You are not on the authorized list for an open session. Ask your lecturer to enroll you before the session opens.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text || ':' || p_student_id::text, 0));
  select check_in_at into existing from public.attendance_records
  where class_session_id = p_class_id and student_id = p_student_id;
  if existing is not null then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'Attendance is already recorded for this session.');
  end if;

  loc := private.school_location_assessment(cls.location_lat, cls.location_lng, cls.geofence_radius_meters, p_location_lat, p_location_lng, p_location_accuracy_meters);
  if cls.location_lat is not null and cls.location_lng is not null and (loc->>'status') is distinct from 'WITHIN_RADIUS' then
    return jsonb_build_object('ok', false, 'status', loc->>'status', 'message', loc->>'message', 'location_verified', false);
  end if;
  captured_at := case
    when (loc->>'status') in ('WITHIN_RADIUS', 'CAPTURED')
      and p_location_captured_at is not null
      and p_location_captured_at <= clock_timestamp() + interval '2 minutes'
      and p_location_captured_at >= clock_timestamp() - interval '15 minutes'
    then p_location_captured_at else clock_timestamp()
  end;

  st := case
    when now_at > (select starts_at from public.sessions where id = p_class_id) + make_interval(mins => cls.late_after_minutes)
    then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status
  end;
  status_label := case when method = 'LIVE_PHOTO' then 'CAPTURED_NOT_COMPARED' else 'MANUAL_NOT_BIOMETRIC' end;

  update public.attendance_records
  set check_in_at = now_at, status = st, live_photo_path = p_photo_path,
      verification_method = method, verification_status = status_label, updated_at = now_at,
      location_lat = case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_lat else null end,
      location_lng = case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_lng else null end,
      location_accuracy_meters = case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_accuracy_meters else null end,
      location_captured_at = case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then captured_at else null end,
      location_distance_meters = (loc->>'distance_meters')::double precision,
      location_status = loc->>'status',
      location_verified = coalesce((loc->>'verified')::boolean, false)
  where class_session_id = p_class_id and student_id = p_student_id and check_in_at is null;

  if not found then
    insert into public.attendance_records (
      organization_id, class_session_id, student_id, check_in_at, status,
      submitted_name, submitted_matric_number, photo_url, live_photo_path,
      verification_mode, verification_method, verification_status,
      location_lat, location_lng, location_accuracy_meters, location_captured_at,
      location_distance_meters, location_status, location_verified
    )
    select p_organization_id, p_class_id, p_student_id, now_at, st,
           p.full_name, sp.matric_number, null, p_photo_path,
           cls.verification_mode, method, status_label,
           case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_lat else null end,
           case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_lng else null end,
           case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then p_location_accuracy_meters else null end,
           case when (loc->>'status') in ('WITHIN_RADIUS','CAPTURED') then captured_at else null end,
           (loc->>'distance_meters')::double precision,
           loc->>'status',
           coalesce((loc->>'verified')::boolean, false)
    from public.people p
    join public.school_profiles sp on sp.id = p.id
    where p.id = p_student_id and p.organization_id = p_organization_id;
    if not found then
      return jsonb_build_object('ok', false, 'message', 'The student profile could not be confirmed. Attendance was not recorded.');
    end if;
  end if;

  insert into public.registered_devices (organization_id, student_id, device_hash)
  values (p_organization_id, p_student_id, p_device_hash)
  on conflict (organization_id, student_id, device_hash) do update set last_seen_at = now_at;
  insert into public.attendance_device_uses (organization_id, class_session_id, student_id, device_hash)
  values (p_organization_id, p_class_id, p_student_id, p_device_hash)
  on conflict do nothing;
  insert into public.presence_events (organization_id, session_id, subject_id, event_type, actor_type, actor_id)
  values (p_organization_id, p_class_id, p_student_id, 'CHECKED_IN', 'student', p_student_id::text);

  begin
    perform private.school_broadcast_class(p_organization_id, p_class_id);
  exception when undefined_function then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'status', st,
    'verification_status', status_label,
    'verification_method', method,
    'message', case
      when method = 'LIVE_PHOTO' then 'Attendance recorded. The photograph was saved and was not compared by a biometric service. '
      else 'Attendance recorded with manual confirmation. This is not a biometric verification. '
    end || coalesce(loc->>'message', ''),
    'location_verified', coalesce((loc->>'verified')::boolean, false),
    'location_status', loc->>'status',
    'course_code', (select c.code from public.courses c where c.id = cls.course_id),
    'course_title', (select c.title from public.courses c where c.id = cls.course_id)
  );
end $$;

commit;
