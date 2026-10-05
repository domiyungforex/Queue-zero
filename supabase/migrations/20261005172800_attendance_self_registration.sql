-- Allow class attendance without lecturer pre-enrollment.
-- A valid rotating QR plus full name + matric number can self-register a student
-- into the current course and class. Manual enrollment remains optional.

create function public.school_scan_open(
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
  shared record;
  clean_name text := btrim(p_full_name);
  clean_matric text := upper(btrim(p_matric_number));
begin
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
    and upper(btrim(sp.matric_number))=clean_matric
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
    insert into public.people(organization_id,type,full_name)
    values(p_organization_id,'STUDENT',clean_name)
    returning id into person;

    insert into public.school_profiles(id,organization_id,department_id,matric_number,level)
    values(person,p_organization_id,course_row.department_id,clean_matric,'Unspecified');
  end if;

  insert into public.course_students(organization_id,course_id,student_id)
  values(p_organization_id,cls.course_id,person)
  on conflict(course_id,student_id) do nothing;

  insert into public.class_roster(organization_id,class_session_id,student_id)
  values(p_organization_id,p_class_id,person)
  on conflict(class_session_id,student_id) do nothing;

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
      result:=jsonb_build_object('ok',false,'action','BLOCKED','status','DUPLICATE_SCAN','message','This scan was already recorded. For departure, scan a new QR after checkout opens.');
      exit transition;
    end if;

    select * into rec from public.attendance_records
    where class_session_id=p_class_id and student_id=person;

    if rec.check_out_at is not null then
      event_name:='DUPLICATE_SCAN';
      insert into public.attendance_flags(organization_id,class_session_id,student_id,reason)
      values(p_organization_id,p_class_id,person,'THIRD_SCAN')
      on conflict do nothing;
      result:=jsonb_build_object('ok',false,'action','BLOCKED','status','THIRD_SCAN','message','Arrival and departure are already recorded. Another scan has been flagged for review.');
      exit transition;
    end if;

    if rec.check_in_at is null then
      if not cls.arrival_open then
        event_name:='INVALID_SCAN';
        result:=jsonb_build_object('ok',false,'action','BLOCKED','status','ARRIVAL_CLOSED','message','Arrival is closed. Please speak to your lecturer.');
        exit transition;
      end if;
      st:=case
        when now_at>(select starts_at from public.sessions where id=p_class_id)+make_interval(mins=>cls.late_after_minutes)
          then 'LATE'::public.attendance_status
        else 'PRESENT'::public.attendance_status
      end;
      insert into public.attendance_records(organization_id,class_session_id,student_id,check_in_at,status)
      values(p_organization_id,p_class_id,person,now_at,st);
      event_name:='CHECKED_IN';
      result:=jsonb_build_object('ok',true,'action','CHECK_IN','status',st,'message','Attendance recorded.');
    else
      if not cls.checkout_enabled then
        event_name:='INVALID_SCAN';
        result:=jsonb_build_object('ok',false,'action','BLOCKED','status','CHECKOUT_CLOSED','message','Your arrival is recorded. Departure scanning is not open yet.');
        exit transition;
      end if;
      st:=case
        when cls.planned_ends_at is not null and now_at<cls.planned_ends_at
          then 'EARLY_LEAVE'::public.attendance_status
        else rec.status
      end;
      update public.attendance_records
      set check_out_at=now_at,status=st,updated_at=now_at where id=rec.id;
      event_name:='CHECKED_OUT';
      result:=jsonb_build_object('ok',true,'action','CHECK_OUT','status',st,'message','Departure recorded.');
    end if;

    insert into public.registered_devices(organization_id,student_id,device_hash)
    values(p_organization_id,person,p_device_hash)
    on conflict(organization_id,student_id,device_hash)
    do update set last_seen_at=now_at;

    insert into public.attendance_device_uses(organization_id,class_session_id,student_id,device_hash)
    values(p_organization_id,p_class_id,person,p_device_hash)
    on conflict do nothing;

    for shared in select distinct student_id
      from public.attendance_device_uses
      where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person
    loop
      insert into public.attendance_flags(organization_id,class_session_id,student_id,reason)
      values
        (p_organization_id,p_class_id,person,'POSSIBLE_PROXY_ATTENDANCE'),
        (p_organization_id,p_class_id,shared.student_id,'POSSIBLE_PROXY_ATTENDANCE')
      on conflict do nothing;
    end loop;
  end transition;

  insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,result)
  values(p_organization_id,p_class_id,person,p_request_id,p_nonce,result);

  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id,metadata)
  values(p_organization_id,p_class_id,person,event_name,'student',null,jsonb_build_object('source','qr_self_registration'));

  perform private.school_broadcast(p_organization_id,p_class_id);
  return result;
end
$$;

revoke all on function public.school_scan_open(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.school_scan_open(uuid,uuid,uuid,text,text,text,uuid) to service_role;
