begin;

-- A valid, open attendance QR accepts name + matric without prior enrollment.
-- An optional imported record is reused, never overwritten. Authentication,
-- signed QR verification, duplicate guards and tenant isolation remain unchanged.
create or replace function public.school_attend_accountless(
 p_organization_id uuid,p_class_id uuid,p_nonce uuid,p_full_name text,p_matric_number text,
 p_device_hash text,p_network_hash text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cls public.class_sessions%rowtype; person uuid; canonical_name text; canonical_matric text; now_at timestamptz:=clock_timestamp(); st public.attendance_status; result jsonb; prior public.attendance_scan_requests%rowtype; matric_key text; outcome text; risk text[]:='{}'; shared uuid; security_mode text; department uuid;
begin
 if p_organization_id is null or p_class_id is null or p_full_name is null or p_matric_number is null or p_device_hash is null or p_network_hash is null or p_request_id is null or p_nonce is null or length(btrim(p_full_name)) not between 1 and 160 or length(btrim(p_matric_number)) not between 1 and 80 or p_device_hash !~ '^[0-9a-f]{64}$' or p_network_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid attendance request' using errcode='22023'; end if;
 -- Match administrative lock order, while allowing different students to scan concurrently.
 perform 1 from public.businesses where id=p_organization_id for share;
 if not private.school_enabled(p_organization_id) then raise exception 'Class unavailable' using errcode='42501'; end if;
 select c.department_id into department from public.courses c
 where c.organization_id=p_organization_id and c.id=(select course_id from public.class_sessions where id=p_class_id and organization_id=p_organization_id) for key share;
 select cs.* into cls from public.class_sessions cs where cs.id=p_class_id and cs.organization_id=p_organization_id for share;
 if not found then raise exception 'Class unavailable' using errcode='42501'; end if;
 perform 1 from public.sessions where id=p_class_id and organization_id=p_organization_id for share;
 now_at:=clock_timestamp();
 select attendance_security_mode into security_mode from public.businesses where id=p_organization_id;
 matric_key:=encode(extensions.digest(convert_to(p_organization_id::text||':'||private.normalized_matric(p_matric_number),'UTF8'),'sha256'),'hex');
 select r.* into prior from public.attendance_scan_requests r join public.school_profiles sp on sp.id=r.student_id join public.people p on p.id=sp.id where r.class_session_id=p_class_id and r.request_id=p_request_id and r.nonce=p_nonce and sp.organization_id=p_organization_id and private.normalized_student_name(p.full_name)=private.normalized_student_name(p_full_name) and private.normalized_matric(sp.matric_number)=private.normalized_matric(p_matric_number);
 if found then return prior.result; end if;
 -- Serialize abuse checks per device/identity, not a shared campus network.
 perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||p_device_hash,1));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||private.normalized_matric(p_matric_number),2));
 now_at:=clock_timestamp();
 if (select count(*) from public.attendance_submission_limits where class_session_id=p_class_id and device_hash=p_device_hash and created_at>now_at-interval '10 minutes')>=20
    or (select count(*) from public.attendance_submission_limits where class_session_id=p_class_id and matric_hash=matric_key and created_at>now_at-interval '10 minutes')>=10
    or (select count(*) from public.attendance_submission_limits where class_session_id=p_class_id and network_hash=p_network_hash and created_at>now_at-interval '10 minutes')>=300 then
  insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome) values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'RATE_LIMITED');
  return jsonb_build_object('ok',false,'status','RATE_LIMITED','message','Too many attempts. Wait a moment or ask your lecturer for help.');
 end if;
 if not exists(select 1 from public.attendance_qr_nonces where nonce=p_nonce and organization_id=p_organization_id and class_session_id=p_class_id and expires_at>now_at)
    or cls.qr_revoked_at is not null or not cls.arrival_open or not exists(select 1 from public.sessions where id=p_class_id and status='OPEN')
    or (cls.attendance_closes_at is not null and cls.attendance_closes_at<=now_at) then
  insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome) values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'CLOSED');
  return jsonb_build_object('ok',false,'status','CLOSED','message','Attendance for this class is closed.');
 end if;
 select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric
 from public.school_profiles sp join public.people p on p.id=sp.id and p.organization_id=sp.organization_id
 where sp.organization_id=p_organization_id and private.normalized_matric(sp.matric_number)=private.normalized_matric(p_matric_number);
 if person is null then
  -- The subtransaction rolls back both rows if a concurrent roster import wins.
  begin
   insert into public.people(organization_id,type,full_name) values(p_organization_id,'STUDENT',btrim(p_full_name)) returning id,full_name into person,canonical_name;
   insert into public.school_profiles(id,organization_id,department_id,matric_number,level)
    values(person,p_organization_id,department,btrim(p_matric_number),'UNSPECIFIED') returning matric_number into canonical_matric;
  exception when unique_violation then
   select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric
   from public.school_profiles sp join public.people p on p.id=sp.id and p.organization_id=sp.organization_id
   where sp.organization_id=p_organization_id and private.normalized_matric(sp.matric_number)=private.normalized_matric(p_matric_number);
   if person is null then raise; end if;
  end;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||person::text,0));
 select * into prior from public.attendance_scan_requests where class_session_id=p_class_id and student_id=person and request_id=p_request_id and nonce=p_nonce;
 if found and private.normalized_student_name(canonical_name)=private.normalized_student_name(p_full_name) then return prior.result; end if;
 if private.normalized_student_name(canonical_name)<>private.normalized_student_name(p_full_name) then
  result:=jsonb_build_object('ok',false,'status','NAME_MISMATCH','message','The name entered does not match the class record.'); outcome:='NAME_MISMATCH';
 elsif exists(select 1 from public.attendance_records where class_session_id=p_class_id and student_id=person) then
 result:=jsonb_build_object('ok',false,'status','DUPLICATE','message','Your attendance has already been recorded for this class.'); outcome:='DUPLICATE';
 else
  now_at:=clock_timestamp();
  if (cls.attendance_closes_at is not null and cls.attendance_closes_at<=now_at)
     or not exists(select 1 from public.attendance_qr_nonces where nonce=p_nonce and organization_id=p_organization_id and class_session_id=p_class_id and expires_at>now_at) then
   -- Roll back a newly created identity too if a concurrent import delayed us.
   raise exception 'Attendance window ended' using errcode='P0020';
  end if;
  st:=case when now_at>(select starts_at from public.sessions where id=p_class_id)+make_interval(mins=>cls.late_after_minutes) then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status end;
  if security_mode<>'BASIC' and exists(select 1 from public.attendance_device_uses where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person) then risk:=array_append(risk,'POSSIBLE_PROXY_ATTENDANCE'); end if;
  insert into public.course_students(organization_id,course_id,student_id) values(p_organization_id,cls.course_id,person) on conflict do nothing;
  insert into public.class_roster(organization_id,class_session_id,student_id) values(p_organization_id,p_class_id,person) on conflict do nothing;
  insert into public.attendance_records(organization_id,class_session_id,student_id,check_in_at,status,submitted_name,submitted_matric_number,risk_flags,flag_reason) values(p_organization_id,p_class_id,person,now_at,st,btrim(p_full_name),btrim(p_matric_number),risk,case when cardinality(risk)>0 then array_to_string(risk,',') end);
  insert into public.registered_devices(organization_id,student_id,device_hash) values(p_organization_id,person,p_device_hash) on conflict(organization_id,student_id,device_hash) do update set last_seen_at=now_at;
  insert into public.attendance_device_uses(organization_id,class_session_id,student_id,device_hash) values(p_organization_id,p_class_id,person,p_device_hash) on conflict do nothing;
  if 'POSSIBLE_PROXY_ATTENDANCE'=any(risk) then
   for shared in select distinct student_id from public.attendance_device_uses where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person loop
    insert into public.attendance_flags(organization_id,class_session_id,student_id,reason) values(p_organization_id,p_class_id,person,'POSSIBLE_PROXY_ATTENDANCE'),(p_organization_id,p_class_id,shared,'POSSIBLE_PROXY_ATTENDANCE') on conflict do nothing;
   end loop;
  end if;
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id) values(p_organization_id,p_class_id,person,'CHECKED_IN','student',person::text),(p_organization_id,p_class_id,person,'ARRIVED','student',person::text);
  result:=jsonb_build_object('ok',true,'status',st,'message','Attendance marked ✓','full_name',canonical_name,'matric_number',canonical_matric,'course_code',(select c.code from public.courses c where c.id=cls.course_id),'recorded_at',now_at,'needs_review',cardinality(risk)>0); outcome:='ACCEPTED';
 end if;
 insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,result) values(p_organization_id,p_class_id,person,p_request_id,p_nonce,result) on conflict do nothing;
 insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome) values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,outcome);
 perform private.school_broadcast(p_organization_id,p_class_id);
 return result;
exception when sqlstate 'P0020' then
 return jsonb_build_object('ok',false,'status','CLOSED','message','Attendance for this class is closed.');
end $$;

revoke all on function public.school_attend_accountless(uuid,uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.school_attend_accountless(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;

commit;
