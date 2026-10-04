begin;

create extension if not exists pgcrypto with schema extensions;

-- Attendance identity is the frozen course roster. Student accounts remain optional.
alter table public.businesses
  add column if not exists attendance_security_mode text not null default 'STANDARD'
  check (attendance_security_mode in ('BASIC','STANDARD','STRICT'));

alter table public.class_sessions
  add column if not exists attendance_closes_at timestamptz,
  add column if not exists qr_revoked_at timestamptz;

alter table public.attendance_records
  add column if not exists submitted_name text,
  add column if not exists submitted_matric_number text,
  add column if not exists risk_flags text[] not null default '{}';

alter table public.attendance_records
  add constraint attendance_submitted_name_length check (submitted_name is null or length(btrim(submitted_name)) between 1 and 160),
  add constraint attendance_submitted_matric_length check (submitted_matric_number is null or length(btrim(submitted_matric_number)) between 1 and 80),
  add constraint attendance_risk_flags_known check (risk_flags <@ array['POSSIBLE_PROXY_ATTENDANCE','RAPID_SUBMISSION','SHARED_NETWORK_VOLUME']::text[]);

-- Existing data used case-sensitive uniqueness. Refuse an ambiguous migration instead
-- of choosing one of two canonical students silently.
do $$
begin
 if exists (
  select 1 from public.school_profiles
  group by organization_id, lower(regexp_replace(btrim(matric_number),'\s+','','g'))
  having count(*) > 1
 ) then
  raise exception 'Normalize duplicate matric numbers before enabling accountless attendance';
 end if;
end $$;
create unique index if not exists school_profiles_org_normalized_matric
  on public.school_profiles(organization_id, lower(regexp_replace(btrim(matric_number),'\s+','','g')));

create table public.attendance_submission_limits (
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.businesses(id),
 class_session_id uuid not null,
 device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
 network_hash text not null check (network_hash ~ '^[0-9a-f]{64}$'),
 matric_hash text not null check (matric_hash ~ '^[0-9a-f]{64}$'),
 outcome text not null check (outcome in ('ACCEPTED','NOT_REGISTERED','NAME_MISMATCH','DUPLICATE','CLOSED','RATE_LIMITED')),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id)
);
create index attendance_limits_device_time on public.attendance_submission_limits(class_session_id,device_hash,created_at desc);
create index attendance_limits_network_time on public.attendance_submission_limits(class_session_id,network_hash,created_at desc);
create index attendance_limits_matric_time on public.attendance_submission_limits(class_session_id,matric_hash,created_at desc);

alter table public.attendance_submission_limits enable row level security;
alter table public.attendance_submission_limits force row level security;
revoke all on public.attendance_submission_limits from public,anon,authenticated,service_role;

create or replace function private.normalized_student_name(p_value text) returns text
language sql immutable strict set search_path='' as $$
 select lower(regexp_replace(btrim(p_value),'\s+',' ','g'))
$$;
create or replace function private.normalized_matric(p_value text) returns text
language sql immutable strict set search_path='' as $$
 select lower(regexp_replace(btrim(p_value),'\s+','','g'))
$$;

-- Dedicated import API: course ownership and the canonical department are resolved
-- inside the database. Email, level and browser-supplied student IDs are unnecessary.
create or replace function public.school_import_roster(p_organization_id uuid,p_course_id uuid,p_students jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; person uuid; department uuid; full_name text; matric text; inserted_count integer:=0; existing_count integer:=0;
begin
 if private.school_lock_course(p_course_id) is distinct from p_organization_id then raise exception 'Course unavailable' using errcode='42501'; end if;
 if jsonb_typeof(p_students) is distinct from 'array' or jsonb_array_length(p_students) not between 1 and 500 then raise exception 'Provide 1 to 500 students' using errcode='22023'; end if;
 select department_id into department from public.courses where id=p_course_id and organization_id=p_organization_id;
 for item in select value from jsonb_array_elements(p_students) loop
  full_name:=btrim(item->>'full_name'); matric:=btrim(item->>'matric_number');
  if length(full_name) not between 1 and 160 or length(matric) not between 1 and 80 then raise exception 'Invalid roster row' using errcode='22023'; end if;
  select sp.id into person from public.school_profiles sp where sp.organization_id=p_organization_id and private.normalized_matric(sp.matric_number)=private.normalized_matric(matric) for update;
  if person is null then
   insert into public.people(organization_id,type,full_name) values(p_organization_id,'STUDENT',full_name) returning id into person;
   insert into public.school_profiles(id,organization_id,department_id,matric_number,level) values(person,p_organization_id,department,matric,'UNSPECIFIED');
  elsif not exists(select 1 from public.people p where p.id=person and private.normalized_student_name(p.full_name)=private.normalized_student_name(full_name)) then
   raise exception 'Existing student name does not match roster' using errcode='22023';
  end if;
  insert into public.course_students(organization_id,course_id,student_id) values(p_organization_id,p_course_id,person) on conflict do nothing;
  if found then inserted_count:=inserted_count+1; else existing_count:=existing_count+1; end if;
 end loop;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_organization_id,'school_enroll',private.current_clerk_user_id(),jsonb_build_object('course_id',p_course_id,'added',inserted_count,'existing',existing_count));
 perform private.school_broadcast(p_organization_id,null);
 return jsonb_build_object('added',inserted_count,'existing',existing_count,'message',inserted_count||' students added.');
end $$;

create or replace function public.school_create_accountless_class(
 p_organization_id uuid,p_course_id uuid,p_starts_at timestamptz,p_planned_ends_at timestamptz,
 p_late_after_minutes integer,p_attendance_closes_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result_id uuid; actor text:=private.current_clerk_user_id();
begin
 if private.school_lock_course(p_course_id) is distinct from p_organization_id then raise exception 'Course unavailable' using errcode='42501'; end if;
 if p_starts_at is null or not isfinite(p_starts_at) or p_late_after_minutes not between 0 and 120
    or p_attendance_closes_at is null or not isfinite(p_attendance_closes_at) or p_attendance_closes_at<=p_starts_at
    or p_attendance_closes_at>p_starts_at+interval '6 hours'
    or (p_planned_ends_at is not null and (not isfinite(p_planned_ends_at) or p_planned_ends_at<=p_starts_at or p_attendance_closes_at>p_planned_ends_at)) then
  raise exception 'Invalid class attendance window' using errcode='22023';
 end if;
 insert into public.sessions(organization_id,type,status,starts_at,created_by) values(p_organization_id,'CLASS','DRAFT',p_starts_at,actor) returning id into result_id;
 insert into public.class_sessions(id,organization_id,course_id,late_after_minutes,departure_required,planned_ends_at,attendance_closes_at) values(result_id,p_organization_id,p_course_id,p_late_after_minutes,false,p_planned_ends_at,p_attendance_closes_at);
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_organization_id,'school_class',actor,jsonb_build_object('id',result_id));
 perform private.school_broadcast(p_organization_id,result_id);
 return jsonb_build_object('id',result_id,'message','Class created.');
end $$;

create or replace function public.school_roster_existing(p_organization_id uuid,p_course_id uuid,p_matric_numbers text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.school_course_access(p_course_id) or not exists(select 1 from public.courses where id=p_course_id and organization_id=p_organization_id) then raise exception 'Course unavailable' using errcode='42501'; end if;
 return jsonb_build_object('existing',(
  select count(*) from unnest(p_matric_numbers) input(matric)
  where exists(select 1 from public.course_students cs join public.school_profiles sp on sp.id=cs.student_id where cs.course_id=p_course_id and private.normalized_matric(sp.matric_number)=private.normalized_matric(input.matric))
 ));
end $$;

-- One class has one stable signed QR nonce. Its database state, rather than a
-- browser timer, closes or revokes attendance.
create or replace function public.school_issue_qr(p_class_id uuid,p_nonce uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cls public.class_sessions%rowtype; org uuid; issued public.attendance_qr_nonces%rowtype; expiry timestamptz;
begin
 select * into cls from public.class_sessions where id=p_class_id;
 if not found then raise exception 'Class unavailable' using errcode='42501'; end if;
 perform private.school_lock_course(cls.course_id);
 org:=private.school_lock_course(cls.course_id);
 select * into cls from public.class_sessions where id=p_class_id for update;
 if cls.qr_revoked_at is not null or not cls.arrival_open or not exists(select 1 from public.sessions where id=p_class_id and status='OPEN') then raise exception 'Attendance is closed' using errcode='22023'; end if;
 if cls.attendance_closes_at is not null and cls.attendance_closes_at<=clock_timestamp() then raise exception 'Attendance is closed' using errcode='22023'; end if;
 select * into issued from public.attendance_qr_nonces where class_session_id=p_class_id and expires_at>clock_timestamp() order by created_at desc limit 1;
 if not found then
  expiry:=least(coalesce(cls.attendance_closes_at,cls.planned_ends_at,clock_timestamp()+interval '12 hours'),clock_timestamp()+interval '18 hours');
  if expiry<=clock_timestamp() then raise exception 'Attendance is closed' using errcode='22023'; end if;
  insert into public.attendance_qr_nonces(nonce,organization_id,class_session_id,expires_at) values(p_nonce,org,p_class_id,expiry) returning * into issued;
 end if;
 return jsonb_build_object('organization_id',org,'session_id',p_class_id,'nonce',issued.nonce,'issued_at',issued.created_at,'expires_at',issued.expires_at);
end $$;

create or replace function public.school_revoke_qr(p_organization_id uuid,p_class_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare course uuid;
begin
 select course_id into course from public.class_sessions where id=p_class_id and organization_id=p_organization_id;
 if course is null then raise exception 'Class unavailable' using errcode='42501'; end if;
 perform private.school_lock_course(course);
 update public.class_sessions set qr_revoked_at=clock_timestamp() where id=p_class_id;
 update public.attendance_qr_nonces set expires_at=least(expires_at,clock_timestamp()) where class_session_id=p_class_id;
 perform private.school_broadcast(p_organization_id,p_class_id);
end $$;

create or replace function public.school_public_class(p_organization_id uuid,p_class_id uuid,p_nonce uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organization_name',b.name,'course_code',c.code,'course_title',c.title,'starts_at',s.starts_at,'planned_ends_at',cs.planned_ends_at,'attendance_closes_at',cs.attendance_closes_at,'open',(s.status='OPEN' and cs.arrival_open and cs.qr_revoked_at is null and (cs.attendance_closes_at is null or cs.attendance_closes_at>clock_timestamp())))
 from public.class_sessions cs join public.sessions s on s.id=cs.id join public.courses c on c.id=cs.course_id join public.businesses b on b.id=cs.organization_id join public.attendance_qr_nonces q on q.class_session_id=cs.id
 where cs.id=p_class_id and cs.organization_id=p_organization_id and q.nonce=p_nonce;
$$;

create or replace function public.school_attend_accountless(
 p_organization_id uuid,p_class_id uuid,p_nonce uuid,p_full_name text,p_matric_number text,
 p_device_hash text,p_network_hash text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cls public.class_sessions%rowtype; person uuid; canonical_name text; canonical_matric text; now_at timestamptz:=clock_timestamp(); st public.attendance_status; result jsonb; prior public.attendance_scan_requests%rowtype; matric_key text; outcome text; risk text[]:='{}'; shared uuid; security_mode text;
begin
 if p_request_id is null or p_nonce is null or length(btrim(p_full_name)) not between 1 and 160 or length(btrim(p_matric_number)) not between 1 and 80 or p_device_hash !~ '^[0-9a-f]{64}$' or p_network_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid attendance request' using errcode='22023'; end if;
 select cs.* into cls from public.class_sessions cs where cs.id=p_class_id and cs.organization_id=p_organization_id;
 if not found then raise exception 'Class unavailable' using errcode='42501'; end if;
 select attendance_security_mode into security_mode from public.businesses where id=p_organization_id;
 matric_key:=encode(extensions.digest(convert_to(p_organization_id::text||':'||private.normalized_matric(p_matric_number),'UTF8'),'sha256'),'hex');
 select r.* into prior from public.attendance_scan_requests r join public.school_profiles sp on sp.id=r.student_id where r.class_session_id=p_class_id and r.request_id=p_request_id and r.nonce=p_nonce and private.normalized_matric(sp.matric_number)=private.normalized_matric(p_matric_number);
 if found then return prior.result; end if;
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
 select p.id,p.full_name,sp.matric_number into person,canonical_name,canonical_matric from public.class_roster r join public.school_profiles sp on sp.id=r.student_id join public.people p on p.id=r.student_id where r.class_session_id=p_class_id and private.normalized_matric(sp.matric_number)=private.normalized_matric(p_matric_number);
 if person is null then
  insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome) values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,'NOT_REGISTERED');
  return jsonb_build_object('ok',false,'status','NOT_REGISTERED','message','You are not registered for this class.');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||person::text,0));
 select * into prior from public.attendance_scan_requests where class_session_id=p_class_id and student_id=person and request_id=p_request_id;
 if found then return prior.result; end if;
 if private.normalized_student_name(canonical_name)<>private.normalized_student_name(p_full_name) then
  result:=jsonb_build_object('ok',false,'status','NAME_MISMATCH','message','The name entered does not match the class record.'); outcome:='NAME_MISMATCH';
 elsif exists(select 1 from public.attendance_records where class_session_id=p_class_id and student_id=person) then
 result:=jsonb_build_object('ok',false,'status','DUPLICATE','message','Your attendance has already been recorded for this class.'); outcome:='DUPLICATE';
 else
  if security_mode<>'BASIC' then perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||p_device_hash,1)); end if;
  now_at:=clock_timestamp();
  st:=case when now_at>(select starts_at from public.sessions where id=p_class_id)+make_interval(mins=>cls.late_after_minutes) then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status end;
  if security_mode<>'BASIC' and exists(select 1 from public.attendance_device_uses where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person) then risk:=array_append(risk,'POSSIBLE_PROXY_ATTENDANCE'); end if;
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
 insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,result) values(p_organization_id,p_class_id,person,p_request_id,p_nonce,result);
 insert into public.attendance_submission_limits(organization_id,class_session_id,device_hash,network_hash,matric_hash,outcome) values(p_organization_id,p_class_id,p_device_hash,p_network_hash,matric_key,outcome);
 perform private.school_broadcast(p_organization_id,p_class_id);
 return result;
end $$;

-- New classes receive a short default arrival window; lecturers may supply a
-- different close time through the dedicated class creation UI in later work.
create or replace function private.accountless_class_defaults() returns trigger language plpgsql set search_path='' as $$
begin
 if new.attendance_closes_at is null then select s.starts_at+interval '30 minutes' into new.attendance_closes_at from public.sessions s where s.id=new.id; end if;
 new.checkout_enabled:=false; new.departure_required:=false;
 return new;
end $$;
drop trigger if exists accountless_class_defaults on public.class_sessions;
create trigger accountless_class_defaults before insert on public.class_sessions for each row execute function private.accountless_class_defaults();

revoke all on function private.normalized_student_name(text),private.normalized_matric(text),private.accountless_class_defaults(),public.school_import_roster(uuid,uuid,jsonb),public.school_create_accountless_class(uuid,uuid,timestamptz,timestamptz,integer,timestamptz),public.school_roster_existing(uuid,uuid,text[]),public.school_issue_qr(uuid,uuid,timestamptz),public.school_revoke_qr(uuid,uuid),public.school_public_class(uuid,uuid,uuid),public.school_attend_accountless(uuid,uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.school_import_roster(uuid,uuid,jsonb),public.school_create_accountless_class(uuid,uuid,timestamptz,timestamptz,integer,timestamptz),public.school_roster_existing(uuid,uuid,text[]),public.school_issue_qr(uuid,uuid,timestamptz),public.school_revoke_qr(uuid,uuid) to authenticated;
grant execute on function public.school_public_class(uuid,uuid,uuid),public.school_attend_accountless(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;

commit;
