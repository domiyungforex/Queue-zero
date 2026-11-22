-- Migration: TuRnMaRk Organization CMS Architecture Redesign
-- Establishes proper Organization Management CMS with delegated operational workspaces,
-- automatic unit synchronization, hierarchy resolution, lecturer assignment workflows,
-- and consolidated institutional attendance oversight.

begin;

-- 1. Ensure private.institution_admin checks both owner and admin roles
create or replace function private.institution_admin(p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.business_role_for(p_org) in ('owner','admin'), false);
$$;

-- 2. Update private.lock_unit_permission: Organization Admins and Owners have organization-wide authority
create or replace function private.lock_unit_permission(p_org uuid, p_unit uuid, p_permission text)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- Institution owners and administrators have full administrative oversight
  if private.institution_admin(p_org) then
    return;
  end if;

  -- If unit is null and not an admin, permission is not granted
  if p_unit is null then
    raise exception 'Unit permission required' using errcode='42501';
  end if;

  perform 1 from public.business_members
    where business_id=p_org and clerk_user_id=private.current_clerk_user_id() for share;

  perform 1 from public.unit_memberships a
    where a.unit_id=p_unit and a.member_id in (
      select id from public.business_members where business_id=p_org and clerk_user_id=private.current_clerk_user_id()
    ) for share;

  if not private.unit_permission(p_org, p_unit, p_permission) then
    raise exception 'Unit permission required' using errcode='42501';
  end if;
end;
$$;

-- 3. Update private.unit_permission to grant access to organization administrators
create or replace function private.unit_permission(p_org uuid, p_unit uuid, p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
  select (
    private.institution_admin(p_org)
    or exists(
      select 1 from public.organization_units u
      where u.id=p_unit and u.organization_id=p_org and u.status='active'
      and exists(
        select 1 from public.unit_memberships a
        join public.business_members m on m.id=a.member_id
        where a.unit_id=u.id and m.clerk_user_id=private.current_clerk_user_id()
        and p_permission=any(a.permissions)
      )
    )
  );
$$;

-- 4. Automatic unit synchronization trigger for faculties
create or replace function private.sync_faculty_unit()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_unit_id uuid;
begin
  if new.unit_id is null then
    insert into public.organization_units (organization_id, name, type, slug, status)
    values (new.organization_id, new.name, 'FACULTY', 'faculty-' || substr(new.id::text, 1, 18), 'active')
    returning id into v_unit_id;

    new.unit_id := v_unit_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_faculty_unit on public.faculties;
create trigger trg_sync_faculty_unit
  before insert on public.faculties
  for each row execute function private.sync_faculty_unit();

-- 5. Automatic unit synchronization trigger for departments
create or replace function private.sync_department_unit()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_faculty_unit uuid;
  v_unit_id uuid;
begin
  if new.unit_id is null then
    -- Retrieve or create parent faculty unit
    select unit_id into v_faculty_unit from public.faculties where id = new.faculty_id;
    if v_faculty_unit is null then
      insert into public.organization_units (organization_id, name, type, slug, status)
      select new.organization_id, f.name, 'FACULTY', 'faculty-' || substr(f.id::text, 1, 18), 'active'
      from public.faculties f where f.id = new.faculty_id
      returning id into v_faculty_unit;

      update public.faculties set unit_id = v_faculty_unit where id = new.faculty_id;
    end if;

    insert into public.organization_units (organization_id, parent_unit_id, name, type, slug, status)
    values (new.organization_id, v_faculty_unit, new.name, 'DEPARTMENT', 'department-' || substr(new.id::text, 1, 18), 'active')
    returning id into v_unit_id;

    new.unit_id := v_unit_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_department_unit on public.departments;
create trigger trg_sync_department_unit
  before insert on public.departments
  for each row execute function private.sync_department_unit();

-- 6. Automatic unit synchronization trigger for courses
create or replace function private.sync_course_unit()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_dept_unit uuid;
begin
  if new.unit_id is null then
    select unit_id into v_dept_unit from public.departments where id = new.department_id;
    new.unit_id := v_dept_unit;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_course_unit on public.courses;
create trigger trg_sync_course_unit
  before insert on public.courses
  for each row execute function private.sync_course_unit();

-- 7. Backfill any existing faculties, departments and courses missing unit_id
do $$
declare
  f record;
  d record;
  c record;
  v_u uuid;
begin
  for f in select * from public.faculties where unit_id is null loop
    insert into public.organization_units(organization_id, name, type, slug, status)
    values(f.organization_id, f.name, 'FACULTY', 'faculty-' || substr(f.id::text, 1, 18), 'active')
    returning id into v_u;
    update public.faculties set unit_id = v_u where id = f.id;
  end loop;

  for d in select d.*, f.unit_id as f_unit from public.departments d join public.faculties f on f.id = d.faculty_id where d.unit_id is null loop
    insert into public.organization_units(organization_id, parent_unit_id, name, type, slug, status)
    values(d.organization_id, d.f_unit, d.name, 'DEPARTMENT', 'department-' || substr(d.id::text, 1, 18), 'active')
    returning id into v_u;
    update public.departments set unit_id = v_u where id = d.id;
  end loop;

  for c in select c.id, d.unit_id as d_unit from public.courses c join public.departments d on d.id = c.department_id where c.unit_id is null loop
    update public.courses set unit_id = c.d_unit where id = c.id;
  end loop;
end;
$$;

-- 8. Add extra fields to public.courses if not already present
alter table public.courses
  add column if not exists academic_session text default '2026/2027',
  add column if not exists semester text default 'FIRST',
  add column if not exists description text,
  add column if not exists status text not null default 'ACTIVE';

-- 9. Add extra fields to public.course_lecturers
alter table public.course_lecturers
  add column if not exists role text not null default 'PRIMARY',
  add column if not exists assigned_at timestamptz not null default now();

-- 10. Update public.institution_invitations to support courses and all roles
alter table public.institution_invitations
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  drop constraint if exists institution_invitations_role_check;

alter table public.institution_invitations
  add constraint institution_invitations_role_check
  check (role in ('OWNER','ORGANIZATION_ADMIN','ORGANIZATION_VIEWER','UNIT_ADMIN','LECTURER','STAFF','ATTENDANCE_OPERATOR'));

-- 11. Enhance public.school_manage to handle course operations smoothly
create or replace function public.school_manage(p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  org uuid := (p_payload->>'organization_id')::uuid;
  actor text := private.current_clerk_user_id();
  result_id uuid;
  course uuid;
  cls public.class_sessions%rowtype;
  s public.sessions%rowtype;
  item jsonb;
  person uuid;
  v_email text;
  profile public.school_profiles%rowtype;
  v_dept_unit uuid;
  v_lec_id text;
  v_lec_name text;
begin
  perform 1 from public.businesses where id = org for share;
  if actor is null or not private.school_enabled(org) or octet_length(p_payload::text) > 131072 then
    raise exception 'School unavailable' using errcode='42501';
  end if;

  if exists(select 1 from public.businesses where id=org and institution_type is not null) then
    if p_action='course' then
      select unit_id into v_dept_unit from public.departments where id=(p_payload->>'department_id')::uuid and organization_id=org;
      perform private.lock_unit_permission(org, v_dept_unit, 'course.create');
    elsif p_action in ('enroll','lecturer','remove_lecturer','class') then
      perform private.lock_institution_course((p_payload->>'course_id')::uuid, case when p_action='class' then 'attendance.start' else 'course.manage' end);
    elsif p_action in ('open','close_arrival','enable_checkout','finish') then
      perform private.lock_institution_course((select course_id from public.class_sessions where id=(p_payload->>'class_id')::uuid and organization_id=org), case when p_action='open' then 'attendance.start' else 'attendance.manage' end);
    elsif p_action='resolve_flag' then
      perform private.lock_institution_course((select c.course_id from public.class_sessions c join public.attendance_flags af on af.class_session_id=c.id where af.id=(p_payload->>'flag_id')::uuid and af.organization_id=org), 'attendance.manage');
    end if;
  end if;

  if p_action in ('faculty','department','lecturer') then
    if not private.school_manager(org) then
      raise exception 'Not authorized' using errcode='42501';
    end if;
  end if;

  if p_action = 'faculty' then
    insert into public.faculties(organization_id, name)
    values(org, btrim(p_payload->>'name'))
    returning id into result_id;

    return jsonb_build_object('id', result_id, 'message', 'Faculty created successfully.');

  elsif p_action = 'department' then
    insert into public.departments(organization_id, faculty_id, name)
    values(org, (p_payload->>'faculty_id')::uuid, btrim(p_payload->>'name'))
    returning id into result_id;

    return jsonb_build_object('id', result_id, 'message', 'Department created successfully.');

  elsif p_action = 'course' then
    perform 1 from public.business_members
    where business_id=org and clerk_user_id=actor
    and (role in ('owner','admin','lecturer') or exists(select 1 from public.businesses where id=org and institution_type is not null))
    for share;
    if not found then raise exception 'Not authorized' using errcode='42501'; end if;

    select unit_id into v_dept_unit from public.departments where id=(p_payload->>'department_id')::uuid and organization_id=org;

    insert into public.courses(
      organization_id, department_id, code, title, unit_id,
      academic_session, semester, description
    ) values (
      org,
      (p_payload->>'department_id')::uuid,
      btrim(p_payload->>'code'),
      btrim(p_payload->>'title'),
      v_dept_unit,
      coalesce(nullif(btrim(p_payload->>'academic_session'), ''), '2026/2027'),
      coalesce(nullif(btrim(p_payload->>'semester'), ''), 'FIRST'),
      nullif(btrim(p_payload->>'description'), '')
    ) returning id into result_id;

    -- If creator is a lecturer, assign them automatically
    if private.business_role_for(org) = 'lecturer' then
      insert into public.course_lecturers(organization_id, course_id, clerk_user_id, display_name)
      values(org, result_id, actor, coalesce(nullif(btrim(p_payload->>'creator_display_name'),''), 'Lecturer'));
    end if;

    -- If a specific lecturer ID was selected by the admin, assign them
    v_lec_id := p_payload->>'lecturer_id';
    v_lec_name := p_payload->>'lecturer_display_name';
    if v_lec_id is not null and v_lec_id ~ '^user_[A-Za-z0-9]+$' then
      insert into public.course_lecturers(organization_id, course_id, clerk_user_id, display_name)
      values(org, result_id, v_lec_id, coalesce(nullif(btrim(v_lec_name), ''), 'Lecturer'))
      on conflict(course_id, clerk_user_id) do update set display_name=excluded.display_name;
    end if;

    return jsonb_build_object('id', result_id, 'message', 'Course created successfully.');

  elsif p_action = 'lecturer' then
    course := (p_payload->>'course_id')::uuid;
    if not exists(select 1 from public.courses where id=course and organization_id=org) or p_payload->>'user_id' !~ '^user_[A-Za-z0-9]+$' then
      raise exception 'Invalid lecturer' using errcode='22023';
    end if;
    insert into public.business_members(business_id, clerk_user_id, role)
    values(org, p_payload->>'user_id', 'lecturer')
    on conflict(business_id, clerk_user_id) do nothing;

    if exists(select 1 from public.business_members where business_id=org and clerk_user_id=p_payload->>'user_id' and role not in ('owner','admin','lecturer')) then
      raise exception 'Choose an owner, administrator or lecturer account' using errcode='22023';
    end if;

    insert into public.course_lecturers(organization_id, course_id, clerk_user_id, display_name, role)
    values(org, course, p_payload->>'user_id', btrim(p_payload->>'display_name'), coalesce(p_payload->>'role', 'PRIMARY'))
    on conflict(course_id, clerk_user_id) do update set display_name=excluded.display_name, role=excluded.role;

    return jsonb_build_object('id', course, 'message', 'Lecturer assigned to course.');

  elsif p_action = 'remove_lecturer' then
    course := (p_payload->>'course_id')::uuid;
    if private.school_lock_course(course) is distinct from org then
      raise exception 'Course unavailable' using errcode='42501';
    end if;
    if not private.school_manager(org) then
      raise exception 'Not authorized' using errcode='42501';
    end if;
    delete from public.course_lecturers
    where course_id=course and organization_id=org and clerk_user_id=p_payload->>'user_id';

    return jsonb_build_object('id', course, 'message', 'Lecturer removed from course.');

  elsif p_action in ('enroll','class') then
    course := (p_payload->>'course_id')::uuid;
    if private.school_lock_course(course) is distinct from org then
      raise exception 'Course unavailable' using errcode='42501';
    end if;

    if p_action = 'enroll' then
      if jsonb_typeof(p_payload->'students') is distinct from 'array' or jsonb_array_length(p_payload->'students') not between 1 and 200 then
        raise exception 'Provide 1 to 200 students' using errcode='22023';
      end if;
      for item in select value from jsonb_array_elements(p_payload->'students') loop
        v_email := lower(btrim(item->>'email'));
        if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
          raise exception 'Invalid enrollment email' using errcode='22023';
        end if;
        insert into public.people(organization_id, type, full_name, email)
        values(org, 'STUDENT', btrim(item->>'full_name'), v_email)
        on conflict(organization_id, email) do nothing;

        select id into person from public.people where organization_id=org and people.email=v_email;
        select * into profile from public.school_profiles where id=person;
        if found and (profile.matric_number is distinct from btrim(item->>'matric_number') or profile.department_id is distinct from (item->>'department_id')::uuid) then
          raise exception 'Existing student identity does not match' using errcode='22023';
        end if;
        insert into public.school_profiles(id, organization_id, department_id, matric_number, level)
        values(person, org, (item->>'department_id')::uuid, btrim(item->>'matric_number'), btrim(item->>'level'))
        on conflict(id) do nothing;

        insert into public.course_students(organization_id, course_id, student_id)
        values(org, course, person)
        on conflict do nothing;
      end loop;
      return jsonb_build_object('id', course, 'message', 'Roster enrolled successfully.');

    else -- class
      if (p_payload->>'starts_at')::timestamptz is null or not isfinite((p_payload->>'starts_at')::timestamptz) then
        raise exception 'Class start is required' using errcode='22023';
      end if;
      insert into public.sessions(organization_id, type, status, starts_at, created_by)
      values(org, 'CLASS', 'DRAFT', (p_payload->>'starts_at')::timestamptz, actor)
      returning id into result_id;

      if p_payload->>'planned_ends_at' is not null and (not isfinite((p_payload->>'planned_ends_at')::timestamptz) or (p_payload->>'planned_ends_at')::timestamptz <= (p_payload->>'starts_at')::timestamptz) then
        raise exception 'Planned end must follow start' using errcode='22023';
      end if;

      insert into public.class_sessions(
        id, organization_id, course_id, late_after_minutes, departure_required, planned_ends_at
      ) values (
        result_id, org, course,
        coalesce((p_payload->>'late_after_minutes')::integer, 10),
        coalesce((p_payload->>'departure_required')::boolean, false),
        (p_payload->>'planned_ends_at')::timestamptz
      );

      return jsonb_build_object('id', result_id, 'message', 'Class session created.');
    end if;

  elsif p_action in ('open','close_arrival','enable_checkout','finish') then
    select * into cls from public.class_sessions where id=(p_payload->>'class_id')::uuid and organization_id=org;
    if not found or private.school_lock_course(cls.course_id) is distinct from org then
      raise exception 'Class unavailable' using errcode='42501';
    end if;
    select * into cls from public.class_sessions where id=cls.id for update;
    select * into s from public.sessions where id=cls.id for update;
    result_id := cls.id;

    if p_action = 'open' then
      if s.status = 'OPEN' then
        return jsonb_build_object('id', result_id, 'message', 'Attendance is open.');
      end if;
      if s.status <> 'DRAFT' then
        raise exception 'Class cannot be reopened' using errcode='22023';
      end if;

      -- If no lecturer is explicitly assigned yet, assign the current actor if they are authorized
      if not exists(select 1 from public.course_lecturers where course_id=cls.course_id) then
        insert into public.course_lecturers(organization_id, course_id, clerk_user_id, display_name)
        values (org, cls.course_id, actor, 'Assigned Instructor')
        on conflict(course_id, clerk_user_id) do nothing;
      end if;

      insert into public.class_lecturers(organization_id, class_session_id, clerk_user_id, display_name)
      select org, cls.id, clerk_user_id, display_name from public.course_lecturers where course_id=cls.course_id
      on conflict do nothing;

      -- Populate frozen roster
      insert into public.class_roster(organization_id, class_session_id, student_id)
      select org, cls.id, student_id from public.course_students where course_id=cls.course_id
      on conflict do nothing;

      update public.sessions set status='OPEN' where id=cls.id;
      return jsonb_build_object('id', result_id, 'message', 'Attendance is now live.');

    elsif p_action = 'close_arrival' then
      if s.status <> 'OPEN' then
        raise exception 'Class arrival must be open to close' using errcode='22023';
      end if;
      update public.class_sessions set arrival_closed_at = clock_timestamp() where id=cls.id;
      return jsonb_build_object('id', result_id, 'message', 'Arrival closed.');

    elsif p_action = 'enable_checkout' then
      if s.status <> 'OPEN' then
        raise exception 'Class must be open to enable checkout' using errcode='22023';
      end if;
      update public.class_sessions set checkout_enabled_at = clock_timestamp() where id=cls.id;
      return jsonb_build_object('id', result_id, 'message', 'Departure check-in enabled.');

    elsif p_action = 'finish' then
      if s.status = 'COMPLETED' then
        return jsonb_build_object('id', result_id, 'message', 'Attendance is already completed.');
      end if;
      update public.sessions set status='COMPLETED', ends_at=clock_timestamp() where id=cls.id;
      delete from public.attendance_qr_nonces where class_session_id=cls.id;
      return jsonb_build_object('id', result_id, 'message', 'Session closed.');
    end if;

  elsif p_action = 'resolve_flag' then
    update public.attendance_flags
    set resolved_at = clock_timestamp(),
        resolution = btrim(p_payload->>'resolution'),
        resolved_by = actor
    where id = (p_payload->>'flag_id')::uuid and organization_id = org;
    return jsonb_build_object('id', (p_payload->>'flag_id')::uuid, 'message', 'Flag resolved.');
  end if;

  raise exception 'Unknown school action: %', p_action using errcode='22023';
end;
$$;

-- 12. RPC for Central Organization CMS Overview
create or replace function public.get_organization_cms_overview(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_res jsonb;
begin
  if not private.institution_admin(p_organization_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select jsonb_build_object(
    'organization_id', p_organization_id,
    'total_faculties', (select count(*) from public.faculties where organization_id = p_organization_id),
    'total_departments', (select count(*) from public.departments where organization_id = p_organization_id),
    'total_units', (select count(*) from public.organization_units where organization_id = p_organization_id and status = 'active'),
    'total_courses', (select count(*) from public.courses where organization_id = p_organization_id and status = 'ACTIVE'),
    'total_lecturers', (select count(distinct clerk_user_id) from public.course_lecturers where organization_id = p_organization_id),
    'total_students', (select count(*) from public.people where organization_id = p_organization_id and type = 'STUDENT'),
    'total_personnel', (select count(*) from public.business_members where business_id = p_organization_id),
    'active_sessions', (select count(*) from public.class_sessions cs join public.sessions s on s.id = cs.id where cs.organization_id = p_organization_id and s.status = 'OPEN'),
    'today_checkins', (select count(*) from public.attendance_records ar where ar.organization_id = p_organization_id and ar.check_in_at >= date_trunc('day', clock_timestamp())),
    'total_queues', (select count(*) from public.queues where business_id = p_organization_id),
    'total_bookings', (select count(*) from public.bookings where organization_id = p_organization_id)
  ) into v_res;

  return v_res;
end;
$$;

-- 13. RPC for Centralized Organization Attendance Oversight
create or replace function public.get_organization_attendance_oversight(
  p_organization_id uuid,
  p_department_id uuid default null,
  p_course_id uuid default null,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_summary jsonb;
  v_records jsonb;
  v_departments jsonb;
  v_courses jsonb;
begin
  if not private.institution_admin(p_organization_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  -- Summary KPIs
  select jsonb_build_object(
    'total_recorded', count(*),
    'present_count', count(*) filter (where ar.status = 'PRESENT'),
    'late_count', count(*) filter (where ar.status = 'LATE'),
    'flagged_count', (select count(*) from public.attendance_flags af where af.organization_id = p_organization_id and af.resolved_at is null),
    'active_classes', (select count(*) from public.class_sessions cs join public.sessions s on s.id = cs.id where cs.organization_id = p_organization_id and s.status = 'OPEN')
  ) into v_summary
  from public.attendance_records ar
  join public.class_sessions cs on cs.id = ar.class_session_id
  where ar.organization_id = p_organization_id
  and (p_course_id is null or cs.course_id = p_course_id);

  -- Departments list for filtering
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name)), '[]'::jsonb) into v_departments
  from public.departments d
  where d.organization_id = p_organization_id
  order by d.name;

  -- Courses list for filtering
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title, 'department_id', c.department_id)), '[]'::jsonb) into v_courses
  from public.courses c
  where c.organization_id = p_organization_id
  order by c.code;

  -- Detailed record rows
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_records
  from (
    select jsonb_build_object(
      'id', ar.id,
      'class_session_id', ar.class_session_id,
      'course_id', c.id,
      'course_code', c.code,
      'course_title', c.title,
      'department_name', d.name,
      'faculty_name', f.name,
      'student_name', p.full_name,
      'matric_number', sp.matric_number,
      'student_level', sp.level,
      'status', ar.status,
      'check_in_at', ar.check_in_at,
      'verification_mode', coalesce(ar.verification_mode, 'STANDARD'),
      'has_photo', (ar.selfie_photo_url is not null),
      'has_geofence', (ar.geofence_verified is true),
      'lecturer_name', coalesce((
        select cl.display_name from public.course_lecturers cl
        where cl.course_id = c.id order by cl.assigned_at asc limit 1
      ), 'Instructor')
    ) as row_data
    from public.attendance_records ar
    join public.class_sessions cs on cs.id = ar.class_session_id
    join public.courses c on c.id = cs.course_id
    join public.departments d on d.id = c.department_id
    join public.faculties f on f.id = d.faculty_id
    join public.people p on p.id = ar.student_id
    left join public.school_profiles sp on sp.id = ar.student_id
    where ar.organization_id = p_organization_id
    and (p_department_id is null or d.id = p_department_id)
    and (p_course_id is null or c.id = p_course_id)
    and (p_status is null or ar.status = p_status)
    order by ar.check_in_at desc nulls last
    limit least(p_limit, 200)
    offset greatest(p_offset, 0)
  ) sub;

  return jsonb_build_object(
    'summary', v_summary,
    'records', v_records,
    'departments', v_departments,
    'courses', v_courses
  );
end;
$$;

-- 14. Update institution_accept_invitation to auto-assign course when course_id is present
create or replace function public.institution_accept_invitation(
  p_token_hash text,
  p_user_id text,
  p_verified_email text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  inv public.institution_invitations;
  mid uuid;
  inviter uuid;
begin
  select * into inv from public.institution_invitations where token_hash=p_token_hash;
  if not found then
    raise exception 'Invitation unavailable' using errcode='42501';
  end if;

  perform 1 from public.businesses where id=inv.organization_id for update;
  select * into inv from public.institution_invitations where id=inv.id for update;

  if inv.revoked_at is not null or inv.expires_at <= clock_timestamp() or p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id) > 255 or inv.email is distinct from lower(btrim(p_verified_email)) then
    raise exception 'Invitation unavailable' using errcode='42501';
  end if;

  if inv.accepted_at is not null then
    if inv.accepted_by <> p_user_id or not exists(select 1 from public.business_members where business_id=inv.organization_id and clerk_user_id=p_user_id) then
      raise exception 'Invitation unavailable' using errcode='42501';
    end if;
    return inv.organization_id;
  end if;

  select id into inviter from public.business_members where business_id=inv.organization_id and clerk_user_id=inv.invited_by;
  if inviter is null or not exists(select 1 from public.business_members where business_id=inv.organization_id and id=inviter and role in ('owner','admin')) then
    if not exists(select 1 from public.unit_memberships a where a.organization_id=inv.organization_id and a.unit_id=inv.unit_id and a.member_id=inviter and 'unit.staff.manage'=any(a.permissions)) then
      raise exception 'Inviter no longer authorized' using errcode='42501';
    end if;
  end if;

  -- Add to business_members with mapping role
  insert into public.business_members(business_id, clerk_user_id, role)
  values(
    inv.organization_id,
    p_user_id,
    case
      when inv.role in ('OWNER','ORGANIZATION_ADMIN') then 'admin'
      when inv.role in ('LECTURER') then 'lecturer'
      else 'staff'
    end
  )
  on conflict(business_id, clerk_user_id) do nothing;

  select id into mid from public.business_members where business_id=inv.organization_id and clerk_user_id=p_user_id;

  -- Add to unit_memberships
  insert into public.unit_memberships(organization_id, unit_id, member_id, role, staff_title, permissions)
  values(
    inv.organization_id,
    inv.unit_id,
    mid,
    case when inv.role in ('LECTURER') then 'LECTURER' else 'STAFF' end,
    inv.staff_title,
    inv.permissions
  )
  on conflict(unit_id, member_id) do update
  set permissions = excluded.permissions, staff_title = coalesce(excluded.staff_title, unit_memberships.staff_title);

  -- If bound to a course, assign lecturer to that course
  if inv.course_id is not null then
    insert into public.course_lecturers(organization_id, course_id, clerk_user_id, display_name, role)
    values(
      inv.organization_id,
      inv.course_id,
      p_user_id,
      coalesce(inv.staff_title, 'Lecturer'),
      'PRIMARY'
    )
    on conflict(course_id, clerk_user_id) do update set role=excluded.role;
  end if;

  update public.institution_invitations
  set accepted_at = clock_timestamp(), accepted_by = p_user_id
  where id = inv.id;

  insert into public.business_events(business_id, type, actor_user_id, metadata)
  values(inv.organization_id, 'staff_invitation_accepted', p_user_id, jsonb_build_object('invitation_id', inv.id, 'unit_id', inv.unit_id));

  return inv.organization_id;
end;
$$;

-- 15. Grants
grant execute on function public.get_organization_cms_overview(uuid) to authenticated;
grant execute on function public.get_organization_attendance_oversight(uuid, uuid, uuid, text, integer, integer) to authenticated;
grant execute on function public.school_manage(text, jsonb) to authenticated;
grant execute on function public.institution_accept_invitation(text, text, text) to service_role;

commit;
