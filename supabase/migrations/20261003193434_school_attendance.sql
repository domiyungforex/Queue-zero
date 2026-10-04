begin;
create table public.sessions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.businesses(id), location_id uuid,
 type public.session_type not null, status public.session_status not null default 'DRAFT', starts_at timestamptz, ends_at timestamptz,
 created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), foreign key(location_id,organization_id) references public.locations(id,business_id), check(starts_at is null or isfinite(starts_at)), check(ends_at is null or isfinite(ends_at)), check(ends_at is null or starts_at is null or ends_at>=starts_at)
);
create table public.people (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.businesses(id), clerk_user_id text,
 type public.person_type not null, full_name text not null check(length(btrim(full_name)) between 1 and 160),
 email text check(length(email)<=254 and email=lower(btrim(email))), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), unique(organization_id,clerk_user_id), unique(organization_id,email)
);
create table public.presence_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.businesses(id), session_id uuid not null,
 subject_id uuid, event_type text not null check(event_type in ('ARRIVED','JOINED_QUEUE','POSITION_UPDATED','CALLED','SERVICE_STARTED','SERVICE_COMPLETED','CHECKED_IN','CHECKED_OUT','LEFT','NO_SHOW','CANCELLED','DUPLICATE_SCAN','INVALID_SCAN','VERIFICATION_FAILED','FLAGGED')),
 occurred_at timestamptz not null default clock_timestamp(), actor_type text not null check(actor_type in ('customer','student','staff','system')), actor_id text,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=2048), created_at timestamptz not null default now(),
 foreign key(session_id,organization_id) references public.sessions(id,organization_id)
);
create index presence_events_session_time on public.presence_events(session_id,occurred_at);
create table public.faculties(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.businesses(id),name text not null check(length(btrim(name)) between 1 and 160),unique(id,organization_id),unique(organization_id,name));
create table public.departments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.businesses(id),faculty_id uuid not null,name text not null check(length(btrim(name)) between 1 and 160),unique(id,organization_id),unique(faculty_id,name),foreign key(faculty_id,organization_id) references public.faculties(id,organization_id));
create table public.school_profiles (
 id uuid primary key,organization_id uuid not null references public.businesses(id),department_id uuid not null,
 matric_number text not null check(length(btrim(matric_number)) between 1 and 80),level text not null check(length(btrim(level)) between 1 and 40),created_at timestamptz not null default now(),
 unique(id,organization_id),unique(organization_id,matric_number),foreign key(id,organization_id) references public.people(id,organization_id),foreign key(department_id,organization_id) references public.departments(id,organization_id)
);
create table public.courses(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.businesses(id),department_id uuid not null,code text not null check(length(btrim(code)) between 1 and 40),title text not null check(length(btrim(title)) between 1 and 200),unique(id,organization_id),unique(organization_id,code),foreign key(department_id,organization_id) references public.departments(id,organization_id));
create table public.course_students(organization_id uuid not null,course_id uuid not null,student_id uuid not null,created_at timestamptz not null default now(),primary key(course_id,student_id),foreign key(course_id,organization_id) references public.courses(id,organization_id),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id));
create table public.course_lecturers(organization_id uuid not null,course_id uuid not null,clerk_user_id text not null,display_name text not null check(length(btrim(display_name)) between 1 and 160),primary key(course_id,clerk_user_id),foreign key(course_id,organization_id) references public.courses(id,organization_id),foreign key(organization_id,clerk_user_id) references public.business_members(business_id,clerk_user_id));
create table public.class_sessions (
 id uuid primary key,organization_id uuid not null,course_id uuid not null,late_after_minutes integer not null default 10 check(late_after_minutes between 0 and 120),
 arrival_open boolean not null default false,checkout_enabled boolean not null default false,departure_required boolean not null default false,
 planned_ends_at timestamptz check(planned_ends_at is null or isfinite(planned_ends_at)),opened_at timestamptz,created_at timestamptz not null default now(),unique(id,organization_id),
 foreign key(id,organization_id) references public.sessions(id,organization_id),foreign key(course_id,organization_id) references public.courses(id,organization_id)
);
create table public.class_lecturers(organization_id uuid not null,class_session_id uuid not null,clerk_user_id text not null,display_name text not null,primary key(class_session_id,clerk_user_id),foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id));
-- Freeze the expected register when arrival opens; later enrollment cannot rewrite history.
create table public.class_roster(organization_id uuid not null,class_session_id uuid not null,student_id uuid not null,primary key(class_session_id,student_id),foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id));
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,class_session_id uuid not null,student_id uuid not null,
 check_in_at timestamptz,check_out_at timestamptz,status public.attendance_status not null,verification_score integer check(verification_score between 0 and 100),flag_reason text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(class_session_id,student_id),
 foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id),
 foreign key(class_session_id,student_id) references public.class_roster(class_session_id,student_id),check(check_out_at is null or (check_in_at is not null and check_out_at>=check_in_at))
);
create table public.attendance_flags(id uuid primary key default gen_random_uuid(),organization_id uuid not null,class_session_id uuid not null,student_id uuid not null,reason text not null check(reason in ('POSSIBLE_PROXY_ATTENDANCE','DUPLICATE_SCAN','THIRD_SCAN')),created_at timestamptz not null default now(),resolved_at timestamptz,resolution text, resolved_by text,unique(class_session_id,student_id,reason),foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id));
create table public.registered_devices(id uuid primary key default gen_random_uuid(),organization_id uuid not null,student_id uuid not null,device_hash text not null check(device_hash~'^[0-9a-f]{64}$'),first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),unique(organization_id,student_id,device_hash),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id));
create table public.attendance_device_uses(organization_id uuid not null,class_session_id uuid not null,student_id uuid not null,device_hash text not null,created_at timestamptz not null default now(),primary key(class_session_id,student_id,device_hash),foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id));
create index attendance_device_session on public.attendance_device_uses(class_session_id,device_hash);
create table public.attendance_qr_nonces(nonce uuid primary key,organization_id uuid not null,class_session_id uuid not null,expires_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id));
create index attendance_qr_expiry on public.attendance_qr_nonces(expires_at);
create table public.attendance_scan_requests(organization_id uuid not null,class_session_id uuid not null,student_id uuid not null,request_id uuid not null,nonce uuid not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(class_session_id,student_id,request_id),foreign key(class_session_id,organization_id) references public.class_sessions(id,organization_id),foreign key(student_id,organization_id) references public.school_profiles(id,organization_id));
create index attendance_scan_nonce on public.attendance_scan_requests(class_session_id,student_id,nonce);

create function private.school_enabled(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.businesses where id=p_org and organization_mode in ('SCHOOL','HYBRID'))$$;
create function private.school_manager(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select private.school_enabled(p_org) and coalesce(private.business_role_for(p_org) in ('owner','admin'),false)$$;
create function private.school_course_access(p_course uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.courses c where c.id=p_course and private.school_enabled(c.organization_id) and (private.school_manager(c.organization_id) or exists(select 1 from public.course_lecturers l join public.business_members m on m.business_id=l.organization_id and m.clerk_user_id=l.clerk_user_id where l.course_id=c.id and l.clerk_user_id=private.current_clerk_user_id() and m.role in ('owner','admin','lecturer'))))$$;
create function private.school_class_access(p_class uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.class_sessions c where c.id=p_class and private.school_course_access(c.course_id))$$;
create function private.school_student_access(p_student uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.people p where p.id=p_student and (p.clerk_user_id=private.current_clerk_user_id() or private.school_manager(p.organization_id) or exists(select 1 from public.course_students e where e.student_id=p.id and private.school_course_access(e.course_id))))$$;
create function private.school_staff(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select private.school_manager(p_org) or (private.school_enabled(p_org) and coalesce(private.business_role_for(p_org)='lecturer',false))$$;

-- No direct writes: all mutations go through role-checked RPCs below.
do $$declare t text;begin foreach t in array array['sessions','people','presence_events','faculties','departments','school_profiles','courses','course_students','course_lecturers','class_sessions','class_lecturers','class_roster','attendance_records','attendance_flags','registered_devices','attendance_device_uses','attendance_qr_nonces','attendance_scan_requests'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;end$$;
grant select on public.sessions,public.people,public.presence_events,public.faculties,public.departments,public.school_profiles,public.courses,public.course_students,public.course_lecturers,public.class_sessions,public.class_lecturers,public.class_roster,public.attendance_records,public.attendance_flags to authenticated;
alter table public.queues add column session_id uuid unique references public.sessions(id);
create policy session_read on public.sessions for select to authenticated using ((type='QUEUE' and exists(select 1 from public.queues q where q.session_id=sessions.id and private.can_access_queue(q.id))) or (type='CLASS' and private.school_class_access(id)));
create policy people_read on public.people for select to authenticated using(private.school_student_access(id));
create policy profiles_read on public.school_profiles for select to authenticated using(private.school_student_access(id));
create policy faculties_read on public.faculties for select to authenticated using(private.school_staff(organization_id));
create policy departments_read on public.departments for select to authenticated using(private.school_staff(organization_id));
create policy courses_read on public.courses for select to authenticated using(private.school_course_access(id));
create policy enrollment_read on public.course_students for select to authenticated using(private.school_course_access(course_id));
create policy lecturers_read on public.course_lecturers for select to authenticated using(private.school_course_access(course_id));
create policy classes_read on public.class_sessions for select to authenticated using(private.school_class_access(id));
create policy class_lecturers_read on public.class_lecturers for select to authenticated using(private.school_class_access(class_session_id));
create policy roster_read on public.class_roster for select to authenticated using(private.school_class_access(class_session_id));
create policy attendance_read on public.attendance_records for select to authenticated using(private.school_class_access(class_session_id));
create policy flags_read on public.attendance_flags for select to authenticated using(private.school_class_access(class_session_id));
create policy presence_read on public.presence_events for select to authenticated using(private.school_class_access(session_id) or exists(select 1 from public.queues q where q.session_id=presence_events.session_id and private.can_access_queue(q.id)));

-- Existing queues/tickets/URLs remain the source of queue behavior.
insert into public.sessions(id,organization_id,location_id,type,status,created_at,updated_at)
 select id,business_id,location_id,'QUEUE',upper(status::text)::public.session_status,created_at,updated_at from public.queues;
update public.queues set session_id=id;
create function private.queue_session_sync() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' then
  insert into public.sessions(id,organization_id,location_id,type,status) values(new.id,new.business_id,new.location_id,'QUEUE',upper(new.status::text)::public.session_status);
  new.session_id:=new.id;
 else
  update public.sessions set status=upper(new.status::text)::public.session_status,location_id=new.location_id,updated_at=clock_timestamp() where id=new.session_id;
 end if;
 return new;end$$;
create trigger queue_session_sync before insert or update of status,location_id on public.queues for each row execute function private.queue_session_sync();
create function private.queue_presence_sync() returns trigger language plpgsql security definer set search_path='' as $$
declare event_name text; sid uuid; org uuid;
begin
 select session_id,business_id into sid,org from public.queues where id=new.queue_id;
 event_name:=case new.type::text when 'joined' then 'JOINED_QUEUE' when 'called' then 'CALLED' when 'completed' then 'SERVICE_COMPLETED' when 'no_show' then 'NO_SHOW' when 'cancelled' then 'CANCELLED' else null end;
 if event_name is not null then
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id) values(org,sid,new.ticket_id,event_name,new.actor_type::text,new.actor_id);
  if new.type::text in ('joined','called','completed','cancelled') then
   insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id) values(org,sid,new.ticket_id,case new.type::text when 'joined' then 'ARRIVED' when 'called' then 'SERVICE_STARTED' else 'LEFT' end,new.actor_type::text,new.actor_id);
  end if;
 end if;return null;end$$;
create trigger queue_presence_sync after insert on public.ticket_events for each row execute function private.queue_presence_sync();

create function public.set_organization_mode(p_organization_id uuid,p_mode public.organization_mode) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.businesses where id=p_organization_id for update;
 perform 1 from public.business_members where business_id=p_organization_id and clerk_user_id=private.current_clerk_user_id() and role='owner' for share;
 if not found or p_mode is null then raise exception 'Not authorized' using errcode='42501';end if;
 if p_mode='BUSINESS' and exists(select 1 from public.sessions where organization_id=p_organization_id and type='CLASS' and status='OPEN') then raise exception 'Finish open classes first' using errcode='22023';end if;
 update public.businesses set organization_mode=p_mode,updated_at=clock_timestamp() where id=p_organization_id;
end$$;
create function public.onboard_organization(p_business_name text,p_industry text,p_country_code text,p_timezone text,p_location_name text,p_location_address text,p_mode public.organization_mode) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid;begin
 org:=public.onboard_business(p_business_name,p_industry,p_country_code,p_timezone,p_location_name,p_location_address);
 perform public.set_organization_mode(org,p_mode);return org;
end$$;

create function private.school_broadcast(p_org uuid,p_class uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  execute 'select realtime.send($1,$2,$3,true)' using '{"changed":true}'::jsonb,'changed','school:'||p_org;
  execute 'select realtime.send($1,$2,$3,true)' using '{"changed":true}'::jsonb,'changed','business:'||p_org;
  if p_class is not null then execute 'select realtime.send($1,$2,$3,true)' using '{"changed":true}'::jsonb,'changed','class:'||p_class;end if;
 end if;
exception when others then raise warning 'School broadcast unavailable';end$$;
-- Lock course before current membership so revocation cannot finish mid-mutation.
create function private.school_lock_course(p_course uuid) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid;begin
 select organization_id into org from public.courses where id=p_course for update;
 if org is null then raise exception 'Course unavailable' using errcode='42501';end if;
 perform 1 from public.business_members where business_id=org and clerk_user_id=private.current_clerk_user_id() for share;
 if not private.school_course_access(p_course) then raise exception 'Course unavailable' using errcode='42501';end if;
 perform 1 from public.course_lecturers where course_id=p_course and clerk_user_id=private.current_clerk_user_id() for share;
 return org;
end$$;
create function public.school_manage(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(p_payload->>'organization_id')::uuid; actor text:=private.current_clerk_user_id(); result_id uuid; course uuid; cls public.class_sessions%rowtype; s public.sessions%rowtype; item jsonb; person uuid; v_email text; profile public.school_profiles%rowtype;
begin
 perform 1 from public.businesses where id=org for share;
 if actor is null or not private.school_enabled(org) or octet_length(p_payload::text)>131072 then raise exception 'School unavailable' using errcode='42501';end if;
 if p_action in ('faculty','department','lecturer') then
  perform private.lock_business_manager(org);
  if not private.school_manager(org) then raise exception 'Not authorized' using errcode='42501';end if;
 end if;
 if p_action='faculty' then
  insert into public.faculties(organization_id,name) values(org,btrim(p_payload->>'name')) returning id into result_id;
 elsif p_action='department' then
  insert into public.departments(organization_id,faculty_id,name) values(org,(p_payload->>'faculty_id')::uuid,btrim(p_payload->>'name')) returning id into result_id;
 elsif p_action='course' then
  perform 1 from public.business_members where business_id=org and clerk_user_id=actor and role in ('owner','admin','lecturer') for share;
  if not found then raise exception 'Not authorized' using errcode='42501';end if;
  insert into public.courses(organization_id,department_id,code,title) values(org,(p_payload->>'department_id')::uuid,btrim(p_payload->>'code'),btrim(p_payload->>'title')) returning id into result_id;
  if private.business_role_for(org)='lecturer' then
   insert into public.course_lecturers(organization_id,course_id,clerk_user_id,display_name) values(org,result_id,actor,btrim(p_payload->>'creator_display_name'));
  end if;
 elsif p_action='lecturer' then
  course:=(p_payload->>'course_id')::uuid;
  if not exists(select 1 from public.courses where id=course and organization_id=org) or p_payload->>'user_id' !~ '^user_[A-Za-z0-9]+$' then raise exception 'Invalid lecturer' using errcode='22023';end if;
  insert into public.business_members(business_id,clerk_user_id,role) values(org,p_payload->>'user_id','lecturer') on conflict(business_id,clerk_user_id) do nothing;
  if exists(select 1 from public.business_members where business_id=org and clerk_user_id=p_payload->>'user_id' and role not in ('owner','admin','lecturer')) then raise exception 'Choose an owner, administrator or lecturer account' using errcode='22023';end if;
  insert into public.course_lecturers(organization_id,course_id,clerk_user_id,display_name) values(org,course,p_payload->>'user_id',btrim(p_payload->>'display_name')) on conflict(course_id,clerk_user_id) do update set display_name=excluded.display_name;
 elsif p_action='remove_lecturer' then
  course:=(p_payload->>'course_id')::uuid;
  if private.school_lock_course(course) is distinct from org then raise exception 'Course unavailable' using errcode='42501';end if;
  perform private.lock_business_manager(org);
  delete from public.course_lecturers where course_id=course and organization_id=org and clerk_user_id=p_payload->>'user_id';
 elsif p_action in ('enroll','class') then
  course:=(p_payload->>'course_id')::uuid;
  if private.school_lock_course(course) is distinct from org then raise exception 'Course unavailable' using errcode='42501';end if;
  if p_action='enroll' then
   if jsonb_typeof(p_payload->'students') is distinct from 'array' or jsonb_array_length(p_payload->'students') not between 1 and 200 then raise exception 'Provide 1 to 200 students' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(p_payload->'students') loop
    v_email:=lower(btrim(item->>'email'));
    if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid enrollment email' using errcode='22023';end if;
    insert into public.people(organization_id,type,full_name,email) values(org,'STUDENT',btrim(item->>'full_name'),v_email) on conflict(organization_id,email) do nothing;
    select id into person from public.people where organization_id=org and people.email=v_email;
    select * into profile from public.school_profiles where id=person;
    if found and (profile.matric_number is distinct from btrim(item->>'matric_number') or profile.department_id is distinct from (item->>'department_id')::uuid) then raise exception 'Existing student identity does not match' using errcode='22023';end if;
    insert into public.school_profiles(id,organization_id,department_id,matric_number,level) values(person,org,(item->>'department_id')::uuid,btrim(item->>'matric_number'),btrim(item->>'level')) on conflict(id) do nothing;
    insert into public.course_students(organization_id,course_id,student_id) values(org,course,person) on conflict do nothing;
   end loop;
  else
   if (p_payload->>'starts_at')::timestamptz is null or not isfinite((p_payload->>'starts_at')::timestamptz) then raise exception 'Class start is required' using errcode='22023';end if;
   insert into public.sessions(organization_id,type,status,starts_at,created_by) values(org,'CLASS','DRAFT',(p_payload->>'starts_at')::timestamptz,actor) returning id into result_id;
   if p_payload->>'planned_ends_at' is not null and (not isfinite((p_payload->>'planned_ends_at')::timestamptz) or (p_payload->>'planned_ends_at')::timestamptz<=(p_payload->>'starts_at')::timestamptz) then raise exception 'Planned end must follow start' using errcode='22023';end if;
   insert into public.class_sessions(id,organization_id,course_id,late_after_minutes,departure_required,planned_ends_at) values(result_id,org,course,coalesce((p_payload->>'late_after_minutes')::integer,10),coalesce((p_payload->>'departure_required')::boolean,false),(p_payload->>'planned_ends_at')::timestamptz);
  end if;
 elsif p_action in ('open','close_arrival','enable_checkout','finish') then
  select * into cls from public.class_sessions where id=(p_payload->>'class_id')::uuid and organization_id=org;
  if not found or private.school_lock_course(cls.course_id) is distinct from org then raise exception 'Class unavailable' using errcode='42501';end if;
  select * into cls from public.class_sessions where id=cls.id for update;
  select * into s from public.sessions where id=cls.id for update;
  result_id:=cls.id;
  if p_action='open' then
   if s.status='OPEN' then return jsonb_build_object('id',result_id,'message','Attendance is open.');end if;
   if s.status<>'DRAFT' then raise exception 'Class cannot be reopened' using errcode='22023';end if;
   if not exists(select 1 from public.course_lecturers where course_id=cls.course_id) then raise exception 'Assign a lecturer before opening attendance' using errcode='22023';end if;
   insert into public.class_lecturers(organization_id,class_session_id,clerk_user_id,display_name) select org,cls.id,clerk_user_id,display_name from public.course_lecturers where course_id=cls.course_id;
   insert into public.class_roster(organization_id,class_session_id,student_id) select org,cls.id,student_id from public.course_students where course_id=cls.course_id;
   update public.class_sessions set arrival_open=true,opened_at=clock_timestamp() where id=cls.id;
   update public.sessions set status='OPEN',updated_at=clock_timestamp() where id=cls.id;
  else
   if s.status<>'OPEN' then raise exception 'Class is not open' using errcode='22023';end if;
   if p_action='close_arrival' then update public.class_sessions set arrival_open=false where id=cls.id;
   elsif p_action='enable_checkout' then update public.class_sessions set checkout_enabled=true where id=cls.id;
   else
    if clock_timestamp()<s.starts_at then raise exception 'Class cannot finish before its scheduled start' using errcode='22023';end if;
    insert into public.attendance_records(organization_id,class_session_id,student_id,status) select org,cls.id,r.student_id,'ABSENT' from public.class_roster r where r.class_session_id=cls.id on conflict(class_session_id,student_id) do nothing;
    if cls.departure_required then update public.attendance_records set status='INCOMPLETE',updated_at=clock_timestamp() where class_session_id=cls.id and check_in_at is not null and check_out_at is null;end if;
    update public.class_sessions set arrival_open=false,checkout_enabled=false where id=cls.id;
    update public.sessions set status='COMPLETED',ends_at=clock_timestamp(),updated_at=clock_timestamp() where id=cls.id;
   end if;
  end if;
 elsif p_action='resolve_flag' then
  select c.* into cls from public.class_sessions c join public.attendance_flags f on f.class_session_id=c.id where f.id=(p_payload->>'flag_id')::uuid and f.organization_id=org;
  if not found or private.school_lock_course(cls.course_id) is distinct from org then raise exception 'Flag unavailable' using errcode='42501';end if;
  if p_payload->>'resolution' is null or length(btrim(p_payload->>'resolution')) not between 1 and 500 then raise exception 'Resolution required' using errcode='22023';end if;
  update public.attendance_flags set resolution=btrim(p_payload->>'resolution'),resolved_by=actor,resolved_at=clock_timestamp() where id=(p_payload->>'flag_id')::uuid and resolved_at is null;
 else raise exception 'Unknown school action' using errcode='22023';end if;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(org,'school_'||p_action,actor,jsonb_strip_nulls(jsonb_build_object('id',result_id)));
 perform private.school_broadcast(org,case when p_action in ('open','close_arrival','enable_checkout','finish','resolve_flag') then cls.id else null end);
 return jsonb_strip_nulls(jsonb_build_object('id',result_id,'message','Saved.'));
end$$;
create function public.school_snapshot(p_organization_id uuid,p_course_id uuid default null,p_class_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; course_filter uuid:=p_course_id;
begin
 if not private.school_staff(p_organization_id) then raise exception 'School unavailable' using errcode='42501';end if;
 if p_class_id is not null then
  select course_id into course_filter from public.class_sessions where id=p_class_id and organization_id=p_organization_id;
  if course_filter is null or not private.school_class_access(p_class_id) or (p_course_id is not null and p_course_id<>course_filter) then raise exception 'Class unavailable' using errcode='42501';end if;
 end if;
 if course_filter is not null and not exists(select 1 from public.courses where id=course_filter and organization_id=p_organization_id and private.school_course_access(id)) then raise exception 'Course unavailable' using errcode='42501';end if;
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
 'lecturers',coalesce((select jsonb_agg(jsonb_build_object('course_id',l.course_id,'clerk_user_id',l.clerk_user_id,'display_name',l.display_name)) from (
 select course_id,clerk_user_id,display_name from public.course_lecturers where course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT'))
 union all select c.course_id,l.clerk_user_id,l.display_name from public.class_lecturers l join allowed_classes c on c.id=l.class_session_id where p_class_id is not null) l),'[]'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'course_id',course_id,'status',status,'starts_at',starts_at,'ends_at',ends_at,'late_after_minutes',late_after_minutes,'checkout_enabled',checkout_enabled,'arrival_open',arrival_open,'departure_required',departure_required,'planned_ends_at',planned_ends_at) order by starts_at desc) from allowed_classes),'[]'),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'check_in_at',check_in_at,'check_out_at',check_out_at,'status',status,'flag_reason',flag_reason)) from public.attendance_records where class_session_id in(select id from allowed_classes)),'[]'),
 'flags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'reason',reason,'created_at',created_at,'resolved_at',resolved_at,'resolution',resolution)) from public.attendance_flags where class_session_id in(select id from allowed_classes)),'[]')
 ) into result;
 return result;
end$$;

create function public.school_issue_qr(p_class_id uuid,p_nonce uuid,p_expires_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare cls public.class_sessions%rowtype;org uuid;begin
 select * into cls from public.class_sessions where id=p_class_id;
 if not found then raise exception 'Class unavailable' using errcode='42501';end if;
 perform 1 from public.businesses where id=cls.organization_id for share;
 org:=private.school_lock_course(cls.course_id);
 select * into cls from public.class_sessions where id=p_class_id for update;
 if not exists(select 1 from public.sessions where id=p_class_id and status='OPEN') or not(cls.arrival_open or cls.checkout_enabled) then raise exception 'Attendance is closed' using errcode='22023';end if;
 if p_nonce is null or p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '45 seconds' then raise exception 'Invalid QR validity' using errcode='22023';end if;
 -- More than enough for a rotating display, bounded against authenticated abuse.
 if (select count(*) from public.attendance_qr_nonces where class_session_id=p_class_id and created_at>clock_timestamp()-interval '1 minute')>=12 then raise exception 'Please wait before refreshing the QR' using errcode='54000';end if;
 delete from public.attendance_qr_nonces where class_session_id=p_class_id and expires_at<clock_timestamp()-interval '5 minutes';
 insert into public.attendance_qr_nonces(nonce,organization_id,class_session_id,expires_at) values(p_nonce,org,p_class_id,p_expires_at);
 return jsonb_build_object('organization_id',org,'session_id',p_class_id,'expires_at',p_expires_at);
end$$;

create function public.school_claim_student(p_organization_id uuid,p_user_id text,p_verified_email text) returns jsonb language plpgsql security definer set search_path='' as $$declare p public.people%rowtype;sp public.school_profiles%rowtype;begin
 perform 1 from public.businesses where id=p_organization_id for share;
 if not private.school_enabled(p_organization_id) or p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id)>255 or p_verified_email is null then raise exception 'Enrollment unavailable' using errcode='42501';end if;
 select * into p from public.people where organization_id=p_organization_id and email=lower(btrim(p_verified_email)) and type='STUDENT' for update;
 if not found or (p.clerk_user_id is not null and p.clerk_user_id<>p_user_id) then raise exception 'Enrollment unavailable' using errcode='42501';end if;
 select * into sp from public.school_profiles where id=p.id;
 if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
 update public.people set clerk_user_id=p_user_id,updated_at=clock_timestamp() where id=p.id;
 insert into public.business_members(business_id,clerk_user_id,role) values(p_organization_id,p_user_id,'student') on conflict(business_id,clerk_user_id) do nothing;
 return jsonb_build_object('id',p.id,'full_name',p.full_name,'matric_number',sp.matric_number,'department_id',sp.department_id,'level',sp.level);
end$$;

create function public.school_scan(p_organization_id uuid,p_class_id uuid,p_nonce uuid,p_user_id text,p_device_hash text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cls public.class_sessions%rowtype;person uuid;rec public.attendance_records%rowtype;previous public.attendance_scan_requests%rowtype;result jsonb;event_name text;now_at timestamptz;st public.attendance_status;shared record;
begin
 perform 1 from public.businesses where id=p_organization_id for share;
 if not private.school_enabled(p_organization_id) then raise exception 'Class unavailable' using errcode='42501';end if;
 if p_request_id is null or p_nonce is null or p_user_id is null or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid attendance request' using errcode='22023';end if;
 select * into cls from public.class_sessions where id=p_class_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Class unavailable' using errcode='42501';end if;
 select p.id into person from public.people p join public.school_profiles sp on sp.id=p.id where p.organization_id=p_organization_id and p.clerk_user_id=p_user_id for share of p;
 if person is null or not exists(select 1 from public.class_roster where class_session_id=cls.id and student_id=person) then raise exception 'You are not enrolled in this class' using errcode='42501';end if;
 now_at:=clock_timestamp();
 select * into previous from public.attendance_scan_requests where class_session_id=p_class_id and student_id=person and request_id=p_request_id;
 if found then
  if previous.nonce<>p_nonce then raise exception 'Retry must use the original QR' using errcode='22023';end if;
  return previous.result;
 end if;
 if (select count(*) from public.attendance_scan_requests where class_session_id=p_class_id and student_id=person and created_at>now_at-interval '10 minutes')>=60 then return jsonb_build_object('ok',false,'action','BLOCKED','status','RATE_LIMITED','message','Too many scans. Please ask your lecturer for help.');end if;
 <<transition>> begin
 if not exists(select 1 from public.attendance_qr_nonces where nonce=p_nonce and organization_id=p_organization_id and class_session_id=p_class_id and expires_at>clock_timestamp()) then
  event_name:='INVALID_SCAN';result:=jsonb_build_object('ok',false,'action','BLOCKED','status','INVALID_QR','message','This QR has expired or belongs to a different class. Scan the current display.');exit transition;
 end if;
 if not exists(select 1 from public.sessions where id=p_class_id and status='OPEN') then event_name:='INVALID_SCAN';result:=jsonb_build_object('ok',false,'action','BLOCKED','status','CLOSED','message','Attendance is closed.');exit transition;end if;
 if exists(select 1 from public.attendance_scan_requests where class_session_id=p_class_id and student_id=person and nonce=p_nonce) then
  event_name:='DUPLICATE_SCAN';result:=jsonb_build_object('ok',false,'action','BLOCKED','status','DUPLICATE_SCAN','message','This scan was already recorded. For departure, scan a new QR after checkout opens.');exit transition;
 end if;
 select * into rec from public.attendance_records where class_session_id=p_class_id and student_id=person;
 if rec.check_out_at is not null then
  event_name:='DUPLICATE_SCAN';
  insert into public.attendance_flags(organization_id,class_session_id,student_id,reason) values(p_organization_id,p_class_id,person,'THIRD_SCAN') on conflict do nothing;
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id,metadata) values(p_organization_id,p_class_id,person,'FLAGGED','student',p_user_id,'{"reason":"THIRD_SCAN"}');
  result:=jsonb_build_object('ok',false,'action','BLOCKED','status','THIRD_SCAN','message','Arrival and departure are already recorded. Another scan has been flagged for review.');exit transition;
 end if;
 if rec.check_in_at is null then
  if not cls.arrival_open then event_name:='INVALID_SCAN';result:=jsonb_build_object('ok',false,'action','BLOCKED','status','ARRIVAL_CLOSED','message','Arrival is closed. Please speak to your lecturer.');exit transition;end if;
  st:=case when now_at>(select starts_at from public.sessions where id=p_class_id)+make_interval(mins=>cls.late_after_minutes) then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status end;
  insert into public.attendance_records(organization_id,class_session_id,student_id,check_in_at,status) values(p_organization_id,p_class_id,person,now_at,st);
  event_name:='CHECKED_IN';result:=jsonb_build_object('ok',true,'action','CHECK_IN','status',st,'message','Attendance recorded.');
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id) values(p_organization_id,p_class_id,person,'ARRIVED','student',p_user_id);
 else
  if not cls.checkout_enabled then event_name:='INVALID_SCAN';result:=jsonb_build_object('ok',false,'action','BLOCKED','status','CHECKOUT_CLOSED','message','Your arrival is recorded. Departure scanning is not open yet.');exit transition;end if;
  st:=case when cls.planned_ends_at is not null and now_at<cls.planned_ends_at then 'EARLY_LEAVE'::public.attendance_status else rec.status end;
  update public.attendance_records set check_out_at=now_at,status=st,updated_at=now_at where id=rec.id;
  event_name:='CHECKED_OUT';result:=jsonb_build_object('ok',true,'action','CHECK_OUT','status',st,'message','Departure recorded.');
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id) values(p_organization_id,p_class_id,person,'LEFT','student',p_user_id);
 end if;
 -- A shared cookie is a risk signal, not proof or an automatic rejection.
 insert into public.registered_devices(organization_id,student_id,device_hash) values(p_organization_id,person,p_device_hash) on conflict(organization_id,student_id,device_hash) do update set last_seen_at=now_at;
 insert into public.attendance_device_uses(organization_id,class_session_id,student_id,device_hash) values(p_organization_id,p_class_id,person,p_device_hash) on conflict do nothing;
 for shared in select distinct student_id from public.attendance_device_uses where class_session_id=p_class_id and device_hash=p_device_hash and student_id<>person loop
  insert into public.attendance_flags(organization_id,class_session_id,student_id,reason) values(p_organization_id,p_class_id,person,'POSSIBLE_PROXY_ATTENDANCE'),(p_organization_id,p_class_id,shared.student_id,'POSSIBLE_PROXY_ATTENDANCE') on conflict do nothing;
  insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id,metadata) values(p_organization_id,p_class_id,person,'FLAGGED','system',null,'{"reason":"POSSIBLE_PROXY_ATTENDANCE"}');
 end loop;
 end transition;
 insert into public.attendance_scan_requests(organization_id,class_session_id,student_id,request_id,nonce,result) values(p_organization_id,p_class_id,person,p_request_id,p_nonce,result);
 insert into public.presence_events(organization_id,session_id,subject_id,event_type,actor_type,actor_id) values(p_organization_id,p_class_id,person,event_name,'student',p_user_id);
 perform private.school_broadcast(p_organization_id,p_class_id);
 return result;
end$$;

create function public.school_replay(p_organization_id uuid,p_class_id uuid,p_nonce uuid,p_user_id text,p_request_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select r.result from public.attendance_scan_requests r join public.people p on p.id=r.student_id and p.organization_id=r.organization_id where r.organization_id=p_organization_id and r.class_session_id=p_class_id and r.nonce=p_nonce and r.request_id=p_request_id and p.clerk_user_id=p_user_id;
$$;
revoke all on function public.school_replay(uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.school_replay(uuid,uuid,uuid,text,uuid) to service_role;

-- Keep existing queue topic authorization byte-for-byte in a private wrapper,
-- then extend only with authorized school/class staff subscriptions.
alter function public.queuezero_receive_topic(text) rename to queuezero_receive_queue_topic;
create function public.queuezero_receive_topic(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select public.queuezero_receive_queue_topic(p_topic)
 or exists(select 1 from public.businesses b where p_topic='school:'||b.id::text and private.school_staff(b.id))
 or exists(select 1 from public.class_sessions c where p_topic='class:'||c.id::text and private.school_class_access(c.id));
$$;
-- Existing policy stores function OID, so replace it to call the extended function.
do $$begin if to_regclass('realtime.messages') is not null then
 execute 'drop policy queuezero_receive on realtime.messages';
 execute $policy$create policy queuezero_receive on realtime.messages for select to anon,authenticated using(extension='broadcast' and public.queuezero_receive_topic(realtime.topic()))$policy$;
end if;end$$;

-- Exact privilege allowlist; no default PUBLIC execution for new definer functions.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('school_enabled','school_manager','school_course_access','school_class_access','school_student_access','school_staff','school_broadcast','school_lock_course','queue_session_sync','queue_presence_sync')) or (n.nspname='public' and p.proname in ('school_manage','school_snapshot','school_issue_qr','school_claim_student','school_scan','set_organization_mode','onboard_organization','queuezero_receive_topic')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end$$;
grant execute on function private.school_enabled(uuid),private.school_manager(uuid),private.school_course_access(uuid),private.school_class_access(uuid),private.school_student_access(uuid),private.school_staff(uuid) to authenticated;
grant execute on function public.school_manage(text,jsonb),public.school_snapshot(uuid,uuid,uuid),public.school_issue_qr(uuid,uuid,timestamptz),public.set_organization_mode(uuid,public.organization_mode),public.onboard_organization(text,text,text,text,text,text,public.organization_mode) to authenticated;
grant execute on function public.school_claim_student(uuid,text,text),public.school_scan(uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.queuezero_receive_topic(text) to anon,authenticated;

create or replace function private.can_access_queue(target_queue_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.queues q
    join public.business_members m on m.business_id = q.business_id
    where q.id = target_queue_id
      and m.clerk_user_id = (select private.current_clerk_user_id())
      and (
        m.role in ('owner', 'admin') or (m.role='staff' and exists (
          select 1 from public.queue_staff_assignments a
          where a.queue_id = q.id and a.business_member_id = m.id
        ))
      )
  );
$$;


create or replace function public.call_next_ticket(p_queue_id uuid,p_request_id uuid)
returns table(outcome text,replayed boolean,ticket_id uuid,display_number text,
  customer_name text,called_at timestamptz,ticket_status public.ticket_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor text := private.current_clerk_user_id();
  q public.queues%rowtype;
  member public.business_members%rowtype;
  prior public.queue_call_requests%rowtype;
  chosen public.tickets%rowtype;
  result_outcome text;
  called_time timestamptz;
begin
  if p_queue_id is null or p_request_id is null then
    raise exception 'Queue and request IDs required' using errcode='22023';
  end if;
  -- Reject unknown/foreign queues identically, before taking a tenant row lock.
  if actor is null or not private.can_access_queue(p_queue_id) then
    raise exception 'Queue access required' using errcode='42501';
  end if;
  select * into q from public.queues where id=p_queue_id for update;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;

  -- Recheck permissions AFTER waiting for the queue lock. Share locks prevent
  -- membership/assignment revocation from committing midway through the action.
  select * into member from public.business_members
    where business_id=q.business_id and clerk_user_id=actor for share;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  if member.role not in ('owner','admin','staff') then raise exception 'Queue access required' using errcode='42501'; end if;
  if member.role='staff' then
    perform 1 from public.queue_staff_assignments
      where queue_id=q.id and business_member_id=member.id and business_id=q.business_id for share;
    if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  end if;

  select * into prior from public.queue_call_requests r where r.queue_id=q.id and r.request_id=p_request_id;
  if found then
    if prior.actor_user_id<>actor then raise exception 'Request unavailable' using errcode='42501'; end if;
    return query select prior.outcome,true,t.id,t.display_number,t.customer_name,t.called_at,t.status
      from (values(1)) as one(n) left join public.tickets t on t.id=prior.ticket_id and t.queue_id=q.id;
    return;
  end if;

  perform 1 from public.locations where id=q.location_id and business_id=q.business_id and is_active for share;
  if not found or q.status<>'open' then
    raise exception 'Queue is not available for calling' using errcode='QZ002';
  end if;
  select * into chosen from public.tickets where queue_id=q.id and status='serving' for update;
  if found then
    result_outcome := 'already_serving';
  else
    -- Do not SKIP LOCKED: queue-level serialization preserves strict FIFO,
    -- including customers from yesterday after daily number resets.
    select * into chosen from public.tickets where queue_id=q.id and status='waiting'
      order by joined_at,id limit 1 for update;
    if not found then
      result_outcome := 'empty';
    else
      called_time := clock_timestamp();
      update public.tickets set status='serving',called_at=called_time,estimated_wait_seconds=0
        where id=chosen.id returning * into chosen;
      insert into public.ticket_events(ticket_id,queue_id,type,actor_type,actor_id,metadata,created_at)
        values(chosen.id,q.id,'called','staff',actor,jsonb_build_object('request_id',p_request_id),called_time);
      result_outcome := 'called';
    end if;
  end if;
  insert into public.queue_call_requests(queue_id,request_id,actor_user_id,outcome,ticket_id)
    values(q.id,p_request_id,actor,result_outcome,chosen.id);
  return query select result_outcome,false,chosen.id,chosen.display_number,chosen.customer_name,chosen.called_at,chosen.status;
end;
$$;

create or replace function private.lock_operable_queue(p_queue_id uuid) returns public.queues
language plpgsql security definer set search_path='' as $$
declare q public.queues; m public.business_members;
begin
 if not private.can_access_queue(p_queue_id) then raise exception 'Queue access required' using errcode='42501'; end if;
 select * into q from public.queues where id=p_queue_id for update;
 select * into m from public.business_members where business_id=q.business_id and clerk_user_id=private.current_clerk_user_id() for share;
 if not found then raise exception 'Queue access required' using errcode='42501'; end if;
 if m.role not in ('owner','admin','staff') then raise exception 'Queue access required' using errcode='42501'; end if;
 if m.role='staff' then
  perform 1 from public.queue_staff_assignments where queue_id=q.id and business_member_id=m.id for share;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;
 end if;
 return q;
end $$;

create or replace function public.save_staff(p_business_id uuid,p_user_id text,p_role public.business_role,p_queue_ids uuid[],p_remove boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor_role public.business_role:=private.business_role_for(p_business_id); member_id uuid; old_role public.business_role;
begin
 if actor_role is null or actor_role not in ('owner','admin') then raise exception 'Manager required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id)>255 or p_role is null or p_role not in ('admin','staff') or p_queue_ids is null or cardinality(p_queue_ids)>100 or p_remove is null then raise exception 'Invalid member' using errcode='22023'; end if;
 if p_user_id=private.current_clerk_user_id() then raise exception 'Cannot edit your own membership' using errcode='42501'; end if;
 -- Queue-first lock order matches operations and prevents revocation midway through a call.
 perform 1 from public.queues where business_id=p_business_id order by id for update;
 actor_role:=private.lock_business_manager(p_business_id);
 select id,role into member_id,old_role from public.business_members where business_id=p_business_id and clerk_user_id=p_user_id for update;
 if old_role='owner' or (actor_role='admin' and (p_role='admin' or old_role='admin')) then raise exception 'Owner required' using errcode='42501'; end if;
 if exists(select 1 from unnest(p_queue_ids) a where not exists(select 1 from public.queues where id=a and business_id=p_business_id)) then raise exception 'Foreign queue' using errcode='42501'; end if;
 if p_remove then
  if member_id is not null then delete from public.queue_staff_assignments where business_member_id=member_id;delete from public.business_members where id=member_id;end if;
 else
  insert into public.business_members(business_id,clerk_user_id,role) values(p_business_id,p_user_id,p_role)
  on conflict(business_id,clerk_user_id) do update set role=excluded.role returning id into member_id;
  delete from public.queue_staff_assignments where business_member_id=member_id;
  insert into public.queue_staff_assignments(business_id,queue_id,business_member_id) select p_business_id,id,member_id from public.queues where business_id=p_business_id and id=any(p_queue_ids);
 end if;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_business_id,case when p_remove then 'staff_removed' else 'staff_saved' end,private.current_clerk_user_id(),jsonb_build_object('member_id',member_id,'role',p_role));
 return member_id;
end $$;

commit;
