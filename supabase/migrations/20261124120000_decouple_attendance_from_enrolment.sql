-- 20261124120000_decouple_attendance_from_enrolment.sql
-- Decouples student attendance checking from mandatory course/class enrolment.
-- Validates that students registered in an institution can attend any open class session in that institution.
-- Preserves institutional isolation, verified name matching, duplicate prevention, and rate limits.

create or replace function public.school_student_lookup(
  p_organization_id uuid,
  p_class_id uuid,
  p_matric_number text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  cls public.class_sessions%rowtype;
  clean_matric text := upper(btrim(coalesce(p_matric_number, '')));
  rec record;
begin
  select * into cls from public.class_sessions
  where id = p_class_id and organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('found', false, 'message', 'Class unavailable');
  end if;
  if length(clean_matric) < 1 then
    return jsonb_build_object('found', false, 'message', 'Enter your matriculation number');
  end if;

  -- 1. Check institutional profile first: any student belonging to this organization is recognized
  select p.id, p.full_name, sp.matric_number, sp.level, sp.programme, d.name as department_name, f.name as faculty_name
  into rec
  from public.people p
  join public.school_profiles sp on sp.id = p.id and sp.organization_id = p_organization_id
  left join public.departments d on d.id = sp.department_id
  left join public.faculties f on f.id = d.faculty_id
  where p.organization_id = p_organization_id
    and p.type = 'STUDENT'
    and private.normalized_matric(sp.matric_number) = private.normalized_matric(clean_matric);

  if rec.id is not null then
    return jsonb_build_object(
      'found', true,
      'student_id', rec.id,
      'full_name', rec.full_name,
      'matric_number', rec.matric_number,
      'level', coalesce(rec.level, 'UNSPECIFIED'),
      'programme', coalesce(rec.department_name, rec.programme, 'General'),
      'department', rec.department_name,
      'faculty', rec.faculty_name
    );
  end if;

  -- 2. Fallback check on class_roster or course_students if school_profiles was not yet populated
  select p.id, p.full_name, coalesce(sp.matric_number, clean_matric) as matric_number, sp.level, sp.programme
  into rec
  from public.class_roster r
  join public.people p on p.id = r.student_id
  left join public.school_profiles sp on sp.id = r.student_id
  where r.class_session_id = p_class_id
    and (
      (sp.matric_number is not null and private.normalized_matric(sp.matric_number) = private.normalized_matric(clean_matric))
      or (p.organization_id = p_organization_id and private.normalized_matric(coalesce(sp.matric_number, '')) = private.normalized_matric(clean_matric))
    );

  if rec.id is not null then
    return jsonb_build_object(
      'found', true,
      'student_id', rec.id,
      'full_name', rec.full_name,
      'matric_number', rec.matric_number,
      'level', coalesce(rec.level, 'UNSPECIFIED'),
      'programme', coalesce(rec.programme, 'General')
    );
  end if;

  return jsonb_build_object(
    'found', false,
    'message', 'That matriculation number is not registered at this institution.'
  );
end $$;

-- Update school_identify_student to return all open sessions across the institution,
-- with enrolled course sessions sorted first, followed by other open course sessions.
create or replace function public.school_identify_student(
  p_organization_id uuid,
  p_matric_number text,
  p_device_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_matric text := upper(btrim(coalesce(p_matric_number, '')));
  person uuid;
  rec record;
  attempts integer;
begin
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' or length(clean_matric) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'Enter the matriculation number issued by your institution.');
  end if;
  if not exists (select 1 from public.businesses where id = p_organization_id and organization_mode in ('SCHOOL', 'HYBRID')) then
    return jsonb_build_object('ok', false, 'code', 'UNKNOWN', 'message', 'No active attendance session was found for that matriculation number.');
  end if;

  select count(*) into attempts from public.attendance_identity_lookups
  where organization_id = p_organization_id and device_hash = p_device_hash and created_at > clock_timestamp() - interval '10 minutes';
  insert into public.attendance_identity_lookups (organization_id, device_hash) values (p_organization_id, p_device_hash);
  if attempts >= 8 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many lookups. Wait a few minutes and try again.');
  end if;

  select p.id, p.full_name, sp.matric_number, sp.level, sp.reference_photo_path,
         d.name as department_name, f.name as faculty_name
  into rec
  from public.school_profiles sp
  join public.people p on p.id = sp.id
  left join public.departments d on d.id = sp.department_id
  left join public.faculties f on f.id = d.faculty_id
  where sp.organization_id = p_organization_id
    and private.normalized_matric(sp.matric_number) = private.normalized_matric(clean_matric);

  if rec.id is null then
    return jsonb_build_object('ok', false, 'code', 'UNKNOWN', 'message', 'That matriculation number is not registered at this institution.');
  end if;
  person := rec.id;

  return jsonb_build_object(
    'ok', true,
    'student_id', person,
    'full_name', rec.full_name,
    'matric_number', rec.matric_number,
    'faculty', rec.faculty_name,
    'department', rec.department_name,
    'level', rec.level,
    'has_photo', rec.reference_photo_path is not null,
    'photo_path', rec.reference_photo_path,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cs.id,
        'code', c.code,
        'title', c.title,
        'session_title', cs.title,
        'starts_at', s.starts_at,
        'location_required', (cs.location_lat is not null and cs.location_lng is not null),
        'location_lat', cs.location_lat,
        'location_lng', cs.location_lng,
        'geofence_radius_meters', cs.geofence_radius_meters,
        'is_enrolled', exists(
          select 1 from public.course_students csub
          where csub.course_id = cs.course_id and csub.student_id = person
        ) or exists(
          select 1 from public.class_roster rsub
          where rsub.class_session_id = cs.id and rsub.student_id = person
        )
      ) order by
        case when exists(
          select 1 from public.course_students csub
          where csub.course_id = cs.course_id and csub.student_id = person
        ) or exists(
          select 1 from public.class_roster rsub
          where rsub.class_session_id = cs.id and rsub.student_id = person
        ) then 0 else 1 end,
        s.starts_at)
      from public.class_sessions cs
      join public.sessions s on s.id = cs.id
      join public.courses c on c.id = cs.course_id
      where cs.organization_id = p_organization_id
        and s.status = 'OPEN'
        and cs.arrival_open
        and cs.qr_revoked_at is null
        and (cs.attendance_closes_at is null or cs.attendance_closes_at > clock_timestamp())
    ), '[]'::jsonb)
  );
end $$;

-- Update school_record_identified_attendance: do NOT reject students not in class_roster.
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
  student_exists boolean;
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

  -- Verify student belongs to this organization
  select exists (
    select 1 from public.people p
    where p.id = p_student_id and p.organization_id = p_organization_id and p.type = 'STUDENT'
  ) into student_exists;
  if not student_exists then
    return jsonb_build_object('ok', false, 'message', 'Student is not registered at this institution.');
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
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', st::text,
    'course_code', (select code from public.courses where id = cls.course_id),
    'message', 'Attendance recorded.'
  );
end $$;

-- Update school_attend_accountless to validate student against the institution
-- in both VERIFIED and STANDARD modes, without requiring course_students or class_roster enrolment,
-- and without auto-inserting students into course_students or class_roster.
CREATE OR REPLACE FUNCTION public.school_attend_accountless(
  p_organization_id uuid,
  p_class_id uuid,
  p_nonce uuid,
  p_full_name text,
  p_matric_number text,
  p_device_hash text,
  p_network_hash text,
  p_request_id uuid,
  p_photo_url text DEFAULT NULL::text,
  p_location_lat double precision DEFAULT NULL::double precision,
  p_location_lng double precision DEFAULT NULL::double precision,
  p_location_accuracy_meters double precision DEFAULT NULL::double precision,
  p_location_captured_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
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
 now_at timestamptz := clock_timestamp();
 st public.attendance_status;
 result jsonb;
 prior public.attendance_scan_requests%rowtype;
 matric_key text;
 outcome text;
 risk text[] := '{}';
 clean_name text := btrim(p_full_name);
 clean_matric text := btrim(p_matric_number);
 loc jsonb;
 loc_verified boolean := false;
 captured_at timestamptz;
begin
 perform set_config('turnmark.block_student_create', 'on', true);
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

 -- Validate student against the institutional record: organization_id + normalized_matric
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||private.normalized_matric(clean_matric),2));
 select p.id, p.full_name, sp.matric_number into person, canonical_name, canonical_matric
 from public.people p
 join public.school_profiles sp on sp.id = p.id and sp.organization_id = p.organization_id
 where p.organization_id = p_organization_id
   and p.type = 'STUDENT'
   and private.normalized_matric(sp.matric_number) = private.normalized_matric(clean_matric)
 for update of p,sp;

 if person is null then
  insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome)
  values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'NOT_REGISTERED');
  return jsonb_build_object('ok',false,'status','NOT_REGISTERED','message','That matriculation number is not registered at this institution. Complete first-time registration before checking into attendance.');
 elsif private.normalized_student_name(canonical_name)<>private.normalized_student_name(clean_name) then
  return jsonb_build_object('ok',false,'status','NAME_MISMATCH','message','That matric number is registered to a different name. Please verify your details.');
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
   if exists(select 1 from public.attendance_device_uses where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person) then
     risk:=array_append(risk,'POSSIBLE_PROXY_ATTENDANCE');
   end if;
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

  result:=jsonb_build_object(
   'ok',true,
   'status',st::text,
   'recorded_at',now_at,
   'course_code',(select code from public.courses where id=cls.course_id),
   'full_name',canonical_name,
   'matric_number',canonical_matric,
   'photo_url',p_photo_url,
   'location_verified',loc_verified,
   'risk_flags',risk
  );
  outcome:=st::text;
 end if;

 insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,outcome,result)
 values(p_organization_id,p_class_id,person,p_request_id,p_nonce,outcome,result);

 return result;
end;
$function$;

-- Update school_scan_open to also not require course enrollment insertion
create or replace function public.school_scan_open(
  p_organization_id uuid,
  p_class_id uuid,
  p_nonce uuid,
  p_full_name text,
  p_matric_number text,
  p_device_hash text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  cls public.class_sessions%rowtype;
  course_row public.courses%rowtype;
  person uuid;
  existing_name text;
  rec public.attendance_records%rowtype;
  previous public.attendance_scan_requests%rowtype;
  result jsonb;
  event_name text;
  now_at timestamptz;
  st public.attendance_status;
  clean_name text := btrim(p_full_name);
  clean_matric text := btrim(p_matric_number);
begin
  perform set_config('turnmark.block_student_create', 'on', true);
  perform 1 from public.businesses where id=p_organization_id for share;
  if not private.school_enabled(p_organization_id) then raise exception 'Class unavailable' using errcode='42501'; end if;
  if p_request_id is null or p_nonce is null
    or length(clean_name) not between 1 and 160
    or length(clean_matric) not between 1 and 80
    or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$'
  then raise exception 'Invalid attendance request' using errcode='22023'; end if;

  select * into cls from public.class_sessions
  where id=p_class_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Class unavailable' using errcode='42501'; end if;

  select * into course_row from public.courses
  where id=cls.course_id and organization_id=p_organization_id;
  if not found then raise exception 'Course unavailable' using errcode='42501'; end if;

  select p.id,p.full_name into person,existing_name
  from public.people p
  join public.school_profiles sp on sp.id=p.id and sp.organization_id=p.organization_id
  where p.organization_id=p_organization_id
    and private.normalized_matric(sp.matric_number)=private.normalized_matric(clean_matric)
    and p.type='STUDENT'
  for update of p,sp;

  if found then
    if lower(regexp_replace(btrim(existing_name),'\s+',' ','g'))
       <> lower(regexp_replace(clean_name,'\s+',' ','g')) then
      return jsonb_build_object(
        'ok',false,'action','BLOCKED','status','IDENTITY_MISMATCH',
        'message','That matric number is already registered to a different name. Check your details or ask the lecturer for help.'
      );
    end if;
  else
    return jsonb_build_object(
      'ok',false,'action','BLOCKED','status','NOT_REGISTERED',
      'message','That matriculation number is not registered. Complete registration with the number your institution issued.'
    );
  end if;

  now_at:=clock_timestamp();

  select * into previous from public.attendance_scan_requests
  where class_session_id=p_class_id and student_id=person and request_id=p_request_id;
  if found then
    if previous.nonce<>p_nonce then raise exception 'Retry must use the original QR' using errcode='22023'; end if;
    return previous.result;
  end if;

  if (select count(*) from public.attendance_scan_requests
      where class_session_id=p_class_id and student_id=person
        and created_at>now_at-interval '10 minutes')>=60 then
    return jsonb_build_object('ok',false,'action','BLOCKED','status','RATE_LIMITED','message','Too many scans. Please ask your lecturer for help.');
  end if;

  <<transition>> begin
    if not exists(
      select 1 from public.attendance_qr_nonces
      where nonce=p_nonce and organization_id=p_organization_id
        and class_session_id=p_class_id and expires_at>clock_timestamp()
    ) then
      event_name:='INVALID_SCAN';
      result:=jsonb_build_object('ok',false,'action','BLOCKED','status','INVALID_QR','message','This QR has expired or belongs to a different class. Scan the current display.');
      exit transition;
    end if;

    if not exists(select 1 from public.sessions where id=p_class_id and status='OPEN') then
      event_name:='INVALID_SCAN';
      result:=jsonb_build_object('ok',false,'action','BLOCKED','status','CLOSED','message','Attendance is closed.');
      exit transition;
    end if;

    if exists(select 1 from public.attendance_scan_requests
      where class_session_id=p_class_id and student_id=person and nonce=p_nonce) then
      event_name:='DUPLICATE_SCAN';
      result:=jsonb_build_object('ok',false,'action','BLOCKED','status','DUPLICATE_SCAN','message','This scan was already recorded.');
      exit transition;
    end if;

    st:=case when now_at>(select starts_at from public.sessions where id=p_class_id)+make_interval(mins=>cls.late_after_minutes)
      then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status end;

    select * into rec from public.attendance_records
    where class_session_id=p_class_id and student_id=person;

    if found then
      result:=jsonb_build_object('ok',false,'action','BLOCKED','status','DUPLICATE','message','Already recorded.');
      exit transition;
    else
      insert into public.attendance_records(
        organization_id,class_session_id,student_id,check_in_at,status,
        submitted_name,submitted_matric_number,verification_mode
      ) values(
        p_organization_id,p_class_id,person,now_at,st,
        existing_name,clean_matric,cls.verification_mode
      );
      event_name:='CHECKIN';
      result:=jsonb_build_object('ok',true,'action','CHECKIN','status',st::text,'recorded_at',now_at,'course_code',course_row.code);
    end if;
  end;

  insert into public.attendance_scan_requests(
    organization_id,class_session_id,student_id,request_id,nonce,outcome,result
  ) values(
    p_organization_id,p_class_id,person,p_request_id,p_nonce,event_name,result
  );

  return result;
end;
$$;
