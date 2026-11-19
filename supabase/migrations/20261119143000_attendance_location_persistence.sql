begin;

-- Persist a single GPS reading with each attendance record.
-- Coordinates are not a continuous track and existing rows are left unchanged.
alter table public.attendance_records
  add column if not exists location_captured_at timestamptz,
  add column if not exists location_distance_meters double precision,
  add column if not exists location_status text;

alter table public.attendance_records drop constraint if exists attendance_records_location_status_check;
alter table public.attendance_records
  add constraint attendance_records_location_status_check
  check (location_status is null or location_status in (
    'WITHIN_RADIUS','OUTSIDE_RADIUS','UNAVAILABLE','INACCURATE','INVALID','CAPTURED','NOT_REQUIRED'
  ));

comment on column public.attendance_records.location_lat is
  'Latitude from the one GPS reading taken at check-in. Not background tracking. Visible only to authorized school staff.';
comment on column public.attendance_records.location_lng is
  'Longitude from the one GPS reading taken at check-in. Not background tracking. Visible only to authorized school staff.';
comment on column public.attendance_records.location_captured_at is
  'Time reported by the device GPS fix, or the server time when that fix is stale. Retained with the attendance record.';

create or replace function private.school_location_assessment(
  p_session_lat double precision,
  p_session_lng double precision,
  p_radius integer,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  distance double precision;
  radius integer;
  required boolean := p_session_lat is not null and p_session_lng is not null;
begin
  if p_lat is null and p_lng is null then
    return jsonb_build_object(
      'status', case when required then 'UNAVAILABLE' else 'NOT_REQUIRED' end,
      'verified', false,
      'distance_meters', null,
      'message', case when required then 'Location was not captured. Allow location access and try again.' else 'Location was not required for this session.' end
    );
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
     or (p_accuracy is not null and (p_accuracy < 0 or p_accuracy > 100000)) then
    return jsonb_build_object('status','INVALID','verified',false,'distance_meters',null,'message','The location coordinates were not valid. Try again.');
  end if;
  if not required then
    return jsonb_build_object('status','CAPTURED','verified',false,'distance_meters',null,'message','Location captured. This session has no attendance zone to compare against.');
  end if;
  radius := least(5000, greatest(10, coalesce(p_radius, 100)));
  distance := 6371000 * 2 * asin(sqrt(
    sin(radians(p_lat - p_session_lat) / 2) ^ 2
    + cos(radians(p_session_lat)) * cos(radians(p_lat)) * sin(radians(p_lng - p_session_lng) / 2) ^ 2
  ));
  if p_accuracy is not null and p_accuracy > greatest(radius, 300) then
    return jsonb_build_object('status','INACCURATE','verified',false,'distance_meters',round(distance::numeric, 1),'message',format('GPS accuracy is too low (±%s m) to confirm the attendance zone. Move outdoors and try again.', round(p_accuracy::numeric)));
  end if;
  if distance <= radius then
    return jsonb_build_object('status','WITHIN_RADIUS','verified',true,'distance_meters',round(distance::numeric, 1),'message',format('Inside the attendance zone (%s m from the class location). This is a GPS reading, not proof of presence by itself.', round(distance::numeric)));
  end if;
  return jsonb_build_object('status','OUTSIDE_RADIUS','verified',false,'distance_meters',round(distance::numeric, 1),'message',format('Outside the attendance zone (%s m away; allowed within %s m). Move into the class area and try again.', round(distance::numeric), radius));
end $$;

revoke all on function private.school_location_assessment(double precision, double precision, integer, double precision, double precision, double precision) from public, anon, authenticated, service_role;

create or replace function public.school_create_accountless_class(
  p_organization_id uuid,
  p_course_id uuid,
  p_starts_at timestamptz,
  p_planned_ends_at timestamptz,
  p_late_after_minutes integer,
  p_attendance_closes_at timestamptz,
  p_verification_mode text,
  p_title text,
  p_location_lat double precision,
  p_location_lng double precision,
  p_geofence_radius_meters integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid; actor text := private.current_clerk_user_id(); radius integer;
begin
  if private.school_lock_course(p_course_id) is distinct from p_organization_id then
    raise exception 'Course unavailable' using errcode = '42501';
  end if;
  if p_verification_mode not in ('STANDARD','VERIFIED') then
    raise exception 'Choose a valid attendance mode' using errcode = '22023';
  end if;
  if p_starts_at is null or not isfinite(p_starts_at) or p_late_after_minutes not between 0 and 120
     or p_attendance_closes_at is null or not isfinite(p_attendance_closes_at) or p_attendance_closes_at <= p_starts_at
     or p_attendance_closes_at > p_starts_at + interval '6 hours'
     or (p_planned_ends_at is not null and (not isfinite(p_planned_ends_at) or p_planned_ends_at <= p_starts_at or p_attendance_closes_at > p_planned_ends_at)) then
    raise exception 'Invalid class attendance window' using errcode = '22023';
  end if;
  if (p_location_lat is null) <> (p_location_lng is null) then
    raise exception 'Enter both latitude and longitude for the attendance zone' using errcode = '22023';
  end if;
  if p_location_lat is not null and (p_location_lat < -90 or p_location_lat > 90 or p_location_lng < -180 or p_location_lng > 180) then
    raise exception 'Location coordinates are not valid' using errcode = '22023';
  end if;
  radius := case when p_location_lat is null then null else coalesce(p_geofence_radius_meters, 100) end;
  if radius is not null and radius not between 10 and 5000 then
    raise exception 'Attendance radius must be between 10 and 5000 meters' using errcode = '22023';
  end if;
  insert into public.sessions(organization_id, type, status, starts_at, created_by)
  values (p_organization_id, 'CLASS', 'DRAFT', p_starts_at, actor)
  returning id into result_id;
  insert into public.class_sessions(
    id, organization_id, course_id, late_after_minutes, departure_required, planned_ends_at,
    attendance_closes_at, verification_mode, title, location_lat, location_lng, geofence_radius_meters
  ) values (
    result_id, p_organization_id, p_course_id, p_late_after_minutes, false, p_planned_ends_at,
    p_attendance_closes_at, p_verification_mode, nullif(btrim(coalesce(p_title, '')), ''),
    p_location_lat, p_location_lng, radius
  );
  insert into public.business_events(business_id, type, actor_user_id, metadata)
  values (p_organization_id, 'school_class', actor, jsonb_build_object('id', result_id, 'verification_mode', p_verification_mode, 'location_required', radius is not null));
  perform private.school_broadcast(p_organization_id, result_id);
  return jsonb_build_object('id', result_id, 'message', 'Class created.');
end $$;

revoke all on function public.school_create_accountless_class(uuid, uuid, timestamptz, timestamptz, integer, timestamptz, text, text, double precision, double precision, integer) from public, anon, authenticated, service_role;
grant execute on function public.school_create_accountless_class(uuid, uuid, timestamptz, timestamptz, integer, timestamptz, text, text, double precision, double precision, integer) to authenticated;

create or replace function public.school_public_class(p_organization_id uuid, p_class_id uuid, p_nonce uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization_name', b.name,
    'course_code', c.code,
    'course_title', c.title,
    'session_title', cs.title,
    'starts_at', s.starts_at,
    'planned_ends_at', cs.planned_ends_at,
    'attendance_closes_at', cs.attendance_closes_at,
    'verification_mode', cs.verification_mode,
    'location_required', (cs.location_lat is not null and cs.location_lng is not null),
    'location_lat', cs.location_lat,
    'location_lng', cs.location_lng,
    'geofence_radius_meters', cs.geofence_radius_meters,
    'open', (s.status = 'OPEN' and cs.arrival_open and cs.qr_revoked_at is null and (cs.attendance_closes_at is null or cs.attendance_closes_at > clock_timestamp()))
  )
  from public.class_sessions cs
  join public.sessions s on s.id = cs.id
  join public.courses c on c.id = cs.course_id
  join public.businesses b on b.id = cs.organization_id
  join public.attendance_qr_nonces q on q.class_session_id = cs.id
  where cs.id = p_class_id and cs.organization_id = p_organization_id and q.nonce = p_nonce;
$$;

revoke all on function public.school_public_class(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.school_public_class(uuid, uuid, uuid) to service_role;

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
 perform private.school_broadcast(p_organization_id,p_class_id);
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.school_snapshot(p_organization_id uuid, p_course_id uuid DEFAULT NULL::uuid, p_class_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 'faculties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.faculties where organization_id=p_organization_id and (unit_id is null or private.unit_visible(organization_id,unit_id))),'[]'),
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'faculty_id',faculty_id,'name',name) order by name) from public.departments where organization_id=p_organization_id and (unit_id is null or private.unit_visible(organization_id,unit_id))),'[]'),
 'courses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'department_id',department_id,'code',code,'title',title) order by code) from allowed_courses),'[]'),
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'matric_number',sp.matric_number,'department_id',sp.department_id,'level',sp.level,'programme',sp.programme) order by p.full_name) from public.people p join public.school_profiles sp on sp.id=p.id where p.id in(select student_id from roster)),'[]'),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(r)) from roster r),'[]'),
 'lecturers',coalesce((select jsonb_agg(jsonb_build_object('course_id',l.course_id,'clerk_user_id',l.clerk_user_id,'display_name',l.display_name)) from (select course_id,clerk_user_id,display_name from public.course_lecturers where course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT')) union all select c.course_id,l.clerk_user_id,l.display_name from public.class_lecturers l join allowed_classes c on c.id=l.class_session_id where p_class_id is not null) l),'[]'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'course_id',course_id,'status',status,'starts_at',starts_at,'ends_at',ends_at,'late_after_minutes',late_after_minutes,'checkout_enabled',checkout_enabled,'arrival_open',arrival_open,'departure_required',departure_required,'planned_ends_at',planned_ends_at,'verification_mode',verification_mode,'title',title,'location_lat',location_lat,'location_lng',location_lng,'geofence_radius_meters',geofence_radius_meters) order by starts_at desc) from allowed_classes),'[]'),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'check_in_at',check_in_at,'check_out_at',check_out_at,'status',status,'flag_reason',flag_reason,'submitted_name',submitted_name,'submitted_matric_number',submitted_matric_number,'photo_url',photo_url,'location_lat',location_lat,'location_lng',location_lng,'location_accuracy_meters',location_accuracy_meters,'location_verified',location_verified,'location_captured_at',location_captured_at,'location_distance_meters',location_distance_meters,'location_status',location_status,'verification_mode',verification_mode)) from public.attendance_records where class_session_id in(select id from allowed_classes)),'[]'),
 'flags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'reason',reason,'created_at',created_at,'resolved_at',resolved_at,'resolution',resolution)) from public.attendance_flags where class_session_id in(select id from allowed_classes)),'[]')
 ) into result;
 return result;
end $function$;

create or replace function public.school_attend_accountless(
 p_organization_id uuid,p_class_id uuid,p_nonce uuid,p_full_name text,p_matric_number text,
 p_device_hash text,p_network_hash text,p_request_id uuid
) returns jsonb language sql security definer set search_path='' as $$
 select public.school_attend_accountless(p_organization_id,p_class_id,p_nonce,p_full_name,p_matric_number,p_device_hash,p_network_hash,p_request_id,null::text,null::double precision,null::double precision,null::double precision,null::timestamptz);
$$;

drop function if exists public.school_attend_accountless(uuid, uuid, uuid, text, text, text, text, uuid, text, double precision, double precision, double precision);

revoke all on function public.school_attend_accountless(uuid, uuid, uuid, text, text, text, text, uuid, text, double precision, double precision, double precision, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.school_attend_accountless(uuid, uuid, uuid, text, text, text, text, uuid, text, double precision, double precision, double precision, timestamptz) to service_role;

drop function if exists public.school_record_identified_attendance(uuid, uuid, uuid, text, text, text);

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
  join public.departments d on d.id = sp.department_id
  join public.faculties f on f.id = d.faculty_id
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
        'geofence_radius_meters', cs.geofence_radius_meters
      ) order by s.starts_at)
      from public.class_roster r
      join public.class_sessions cs on cs.id = r.class_session_id
      join public.sessions s on s.id = cs.id
      join public.courses c on c.id = cs.course_id
      where r.student_id = person
        and r.organization_id = p_organization_id
        and s.status = 'OPEN'
        and cs.arrival_open
        and cs.qr_revoked_at is null
        and (cs.attendance_closes_at is null or cs.attendance_closes_at > clock_timestamp())
    ), '[]'::jsonb)
  );
end $$;

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
    perform private.school_broadcast(p_organization_id, p_class_id);
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


revoke all on function public.school_record_identified_attendance(uuid, uuid, uuid, text, text, text, double precision, double precision, double precision, timestamptz) from public, anon, authenticated;
grant execute on function public.school_record_identified_attendance(uuid, uuid, uuid, text, text, text, double precision, double precision, double precision, timestamptz) to service_role;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261119143000', 'attendance_location_persistence')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
