begin;

alter table public.school_profiles
  add column if not exists phone text,
  add column if not exists reference_photo_path text,
  add column if not exists photo_enrolled_at timestamptz,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text;

alter table public.attendance_records
  add column if not exists verification_method text,
  add column if not exists verification_status text,
  add column if not exists live_photo_path text;

alter table public.school_profiles drop constraint if exists school_profiles_phone_length;
alter table public.school_profiles
  add constraint school_profiles_phone_length check (phone is null or length(btrim(phone)) between 7 and 20);

-- Departments a course may draw from. This never enrolls a student by itself.
create table if not exists public.course_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id),
  course_id uuid not null,
  department_id uuid not null,
  level text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (course_id, department_id, level),
  foreign key (course_id, organization_id) references public.courses(id, organization_id),
  foreign key (department_id, organization_id) references public.departments(id, organization_id)
);

alter table public.course_audiences enable row level security;
alter table public.course_audiences force row level security;
revoke all on public.course_audiences from public, anon, authenticated, service_role;
grant select on public.course_audiences to authenticated;
drop policy if exists course_audiences_read on public.course_audiences;
create policy course_audiences_read on public.course_audiences
  for select to authenticated using (private.school_course_access(course_id));

create table if not exists public.attendance_identity_lookups (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.attendance_identity_lookups enable row level security;
alter table public.attendance_identity_lookups force row level security;
revoke all on public.attendance_identity_lookups from public, anon, authenticated, service_role;

create or replace function public.school_public_directory(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare org_name text;
begin
  select b.name into org_name from public.businesses b
  where b.id = p_organization_id and b.organization_mode in ('SCHOOL', 'HYBRID');
  if org_name is null then
    return jsonb_build_object('ok', false, 'message', 'This institution is not accepting student registration.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'institution', org_name,
    'faculties', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by f.name)
      from public.faculties f where f.organization_id = p_organization_id
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'faculty_id', d.faculty_id, 'name', d.name) order by d.name)
      from public.departments d where d.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.school_register_student(
  p_organization_id uuid,
  p_full_name text,
  p_matric_number text,
  p_faculty_id uuid,
  p_department_id uuid,
  p_level text,
  p_email text,
  p_phone text,
  p_consent boolean,
  p_photo_path text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  person uuid;
  clean_name text := btrim(p_full_name);
  clean_matric text := upper(btrim(p_matric_number));
  clean_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_level text := btrim(p_level);
begin
  if not exists (select 1 from public.businesses where id = p_organization_id and organization_mode in ('SCHOOL', 'HYBRID')) then
    return jsonb_build_object('ok', false, 'message', 'This institution is not accepting registration.');
  end if;
  if p_consent is not true then
    return jsonb_build_object('ok', false, 'message', 'Registration needs your consent to store a reference photograph.');
  end if;
  if p_photo_path is null or p_photo_path !~ ('^reference/' || p_organization_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    return jsonb_build_object('ok', false, 'message', 'A reference photograph must be stored before the profile is created.');
  end if;
  if length(clean_name) not between 1 and 160 or length(clean_matric) not between 1 and 80 or length(clean_level) not between 1 and 40 then
    return jsonb_build_object('ok', false, 'message', 'Check the name, matriculation number and academic level.');
  end if;
  if clean_email is not null and clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'message', 'Enter a valid email address or leave it blank.');
  end if;
  if clean_phone is not null and length(clean_phone) not between 7 and 20 then
    return jsonb_build_object('ok', false, 'message', 'Enter a valid phone number or leave it blank.');
  end if;
  if clean_email is null and clean_phone is null then
    return jsonb_build_object('ok', false, 'message', 'Add an email address or a phone number.');
  end if;
  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.organization_id = p_organization_id and d.faculty_id = p_faculty_id
  ) then
    return jsonb_build_object('ok', false, 'message', 'Choose a department that belongs to the selected faculty.');
  end if;
  if exists (
    select 1 from public.school_profiles sp
    where sp.organization_id = p_organization_id
      and private.normalized_matric(sp.matric_number) = private.normalized_matric(clean_matric)
  ) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'This matriculation number is already registered at this institution.');
  end if;
  if clean_email is not null and exists (select 1 from public.people where organization_id = p_organization_id and email = clean_email) then
    return jsonb_build_object('ok', false, 'message', 'That email is already used at this institution.');
  end if;

  insert into public.people (organization_id, type, full_name, email)
  values (p_organization_id, 'STUDENT', clean_name, clean_email)
  returning id into person;

  insert into public.school_profiles (
    id, organization_id, department_id, matric_number, level, phone,
    reference_photo_path, photo_enrolled_at, consent_at, consent_version
  ) values (
    person, p_organization_id, p_department_id, clean_matric, clean_level, clean_phone,
    p_photo_path, clock_timestamp(), clock_timestamp(), '2026-11-student-photo-v1'
  );

  return jsonb_build_object('ok', true, 'student_id', person, 'message', 'Registration saved. Use your matriculation number the next time you attend.');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'This matriculation number or email is already registered.');
end $$;

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
        'starts_at', s.starts_at
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
  p_device_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cls public.class_sessions%rowtype;
  now_at timestamptz := clock_timestamp();
  st public.attendance_status;
  existing timestamptz;
  method text := case when p_method = 'MANUAL_DECLARED' then 'MANUAL_DECLARED' else 'LIVE_PHOTO' end;
  status_label text;
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

  st := case
    when now_at > (select starts_at from public.sessions where id = p_class_id) + make_interval(mins => cls.late_after_minutes)
    then 'LATE'::public.attendance_status else 'PRESENT'::public.attendance_status
  end;
  status_label := case when method = 'LIVE_PHOTO' then 'CAPTURED_NOT_COMPARED' else 'MANUAL_NOT_BIOMETRIC' end;

  update public.attendance_records
  set check_in_at = now_at, status = st, live_photo_path = p_photo_path,
      verification_method = method, verification_status = status_label, updated_at = now_at
  where class_session_id = p_class_id and student_id = p_student_id and check_in_at is null;

  if not found then
    insert into public.attendance_records (
      organization_id, class_session_id, student_id, check_in_at, status,
      submitted_name, submitted_matric_number, photo_url, live_photo_path,
      verification_mode, verification_method, verification_status
    )
    select p_organization_id, p_class_id, p_student_id, now_at, st,
           p.full_name, sp.matric_number, null, p_photo_path,
           cls.verification_mode, method, status_label
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
      when method = 'LIVE_PHOTO' then 'Attendance recorded. The photograph was saved and was not compared by a biometric service.'
      else 'Attendance recorded with manual confirmation. This is not a biometric verification.'
    end,
    'course_code', (select c.code from public.courses c where c.id = cls.course_id),
    'course_title', (select c.title from public.courses c where c.id = cls.course_id)
  );
end $$;

create or replace function public.school_correct_student(p_organization_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  student uuid := (p_payload->>'student_id')::uuid;
  clean_name text := btrim(p_payload->>'full_name');
  clean_matric text := upper(btrim(p_payload->>'matric_number'));
  clean_level text := btrim(p_payload->>'level');
  department uuid := (p_payload->>'department_id')::uuid;
begin
  if private.current_clerk_user_id() is null or not private.school_manager(p_organization_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if length(clean_name) not between 1 and 160 or length(clean_matric) not between 1 and 80 or length(clean_level) not between 1 and 40 then
    return jsonb_build_object('ok', false, 'message', 'Check the name, matriculation number and level.');
  end if;
  if not exists (select 1 from public.departments where id = department and organization_id = p_organization_id) then
    return jsonb_build_object('ok', false, 'message', 'Choose a department in this institution.');
  end if;
  if not exists (select 1 from public.school_profiles where id = student and organization_id = p_organization_id) then
    return jsonb_build_object('ok', false, 'message', 'That student profile was not found.');
  end if;
  if exists (
    select 1 from public.school_profiles sp
    where sp.organization_id = p_organization_id and sp.id <> student
      and private.normalized_matric(sp.matric_number) = private.normalized_matric(clean_matric)
  ) then
    return jsonb_build_object('ok', false, 'message', 'Another student already uses that matriculation number.');
  end if;
  update public.people set full_name = clean_name, updated_at = clock_timestamp()
  where id = student and organization_id = p_organization_id;
  update public.school_profiles
  set matric_number = clean_matric, level = clean_level, department_id = department,
      phone = nullif(btrim(coalesce(p_payload->>'phone', '')), '')
  where id = student and organization_id = p_organization_id;
  return jsonb_build_object('ok', true, 'message', 'Student details updated.');
exception when unique_violation then
  return jsonb_build_object('ok', false, 'message', 'Another student already uses that matriculation number.');
end $$;

create or replace function public.school_set_course_audience(p_organization_id uuid, p_course_id uuid, p_department_ids uuid[], p_level text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare department uuid;
begin
  if private.current_clerk_user_id() is null or private.school_lock_course(p_course_id) is distinct from p_organization_id then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_department_ids is null or cardinality(p_department_ids) not between 1 and 30 then
    return jsonb_build_object('ok', false, 'message', 'Select at least one department.');
  end if;
  delete from public.course_audiences where course_id = p_course_id and organization_id = p_organization_id;
  foreach department in array p_department_ids loop
    if not exists (select 1 from public.departments where id = department and organization_id = p_organization_id) then
      raise exception 'Department is outside this institution' using errcode = '22023';
    end if;
    insert into public.course_audiences (organization_id, course_id, department_id, level)
    values (p_organization_id, p_course_id, department, nullif(btrim(coalesce(p_level, '')), ''));
  end loop;
  return jsonb_build_object('ok', true, 'message', 'Course audience saved. Students are enrolled only from the roster, not from the department list.');
end $$;

revoke all on function public.school_public_directory(uuid) from public, anon, authenticated;
revoke all on function public.school_register_student(uuid, text, text, uuid, uuid, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.school_identify_student(uuid, text, text) from public, anon, authenticated;
revoke all on function public.school_record_identified_attendance(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.school_public_directory(uuid) to service_role;
grant execute on function public.school_register_student(uuid, text, text, uuid, uuid, text, text, text, boolean, text) to service_role;
grant execute on function public.school_identify_student(uuid, text, text) to service_role;
grant execute on function public.school_record_identified_attendance(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.school_correct_student(uuid, jsonb) to authenticated;
grant execute on function public.school_set_course_audience(uuid, uuid, uuid[], text) to authenticated;

commit;
