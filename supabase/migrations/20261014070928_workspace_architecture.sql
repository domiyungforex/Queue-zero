begin;

create type public.organization_type as enum (
  'UNIVERSITY_SCHOOL',
  'HOSPITAL_CLINIC',
  'BANK_FINANCIAL',
  'SALON_BARBERSHOP',
  'GOVERNMENT_OFFICE',
  'COMPANY_OTHER'
);

alter table public.businesses
  add column organization_type public.organization_type,
  add column onboarding_request_id uuid,
  add column onboarding_completed_at timestamptz,
  add constraint businesses_workspace_metadata_check check (
    (workspace_ownership = 'INDIVIDUAL' and organization_type is null and onboarding_request_id is null)
    or
    (workspace_ownership = 'ORGANIZATION' and professional_category is null)
  ),
  add constraint businesses_onboarding_completed_at_check check (
    onboarding_completed_at is null or isfinite(onboarding_completed_at)
  );

create unique index businesses_owner_onboarding_request
  on public.businesses (owner_user_id, onboarding_request_id)
  where onboarding_request_id is not null;

comment on column public.businesses.organization_type is
  'Self-declared organization category used to configure a workspace. It is not proof that an institution has adopted TuRnMaRk.';
comment on column public.businesses.onboarding_request_id is
  'Actor-scoped idempotency key for organization workspace creation.';
comment on column public.businesses.onboarding_completed_at is
  'Server timestamp set only after the workspace owner membership and creation audit event are persisted.';

create function private.mark_workspace_onboarding_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('business_created', 'professional_workspace_created') then
    update public.businesses
      set onboarding_completed_at = coalesce(onboarding_completed_at, new.created_at)
      where id = new.business_id;
  end if;
  return null;
end;
$$;
revoke all on function private.mark_workspace_onboarding_complete() from public, anon, authenticated, service_role;

create trigger business_events_mark_onboarding_complete
  after insert on public.business_events
  for each row execute function private.mark_workspace_onboarding_complete();

update public.businesses b
set onboarding_completed_at = created.created_at
from (
  select business_id, min(created_at) as created_at
  from public.business_events
  where type in ('business_created', 'professional_workspace_created')
  group by business_id
) created
where b.id = created.business_id
  and b.onboarding_completed_at is null;

-- The existing function used the same identifier for its PL/pgSQL record and
-- its faculties table alias. PostgreSQL therefore rejected institution setup
-- before any school workspace could finish. Keep its behavior and authorization
-- boundary while using unambiguous identifiers.
create or replace function public.institution_setup(
  p_organization_id uuid,
  p_type text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  root_unit uuid;
  faculty_row record;
  department_row record;
  created_unit uuid;
begin
  perform 1 from public.businesses where id = p_organization_id for update;
  perform private.lock_business_manager(p_organization_id);
  if p_type is null or p_type not in ('UNIVERSITY', 'POLYTECHNIC', 'COLLEGE', 'SECONDARY_SCHOOL', 'TRAINING_INSTITUTION', 'OTHER') then
    raise exception 'Invalid institution type' using errcode = '22023';
  end if;

  update public.businesses
    set institution_type = p_type, organization_mode = 'HYBRID'
    where id = p_organization_id;
  insert into public.organization_units (organization_id, name, type, slug)
    values (p_organization_id, 'Administration', 'ADMINISTRATION', 'administration')
    on conflict (organization_id, slug) do nothing;
  select ou.id into root_unit
    from public.organization_units ou
    where ou.organization_id = p_organization_id and ou.slug = 'administration';
  update public.queues set unit_id = root_unit
    where business_id = p_organization_id and unit_id is null;

  for faculty_row in
    select fa.* from public.faculties fa
    where fa.organization_id = p_organization_id and fa.unit_id is null
  loop
    insert into public.organization_units (organization_id, name, type, slug)
      values (p_organization_id, faculty_row.name, 'FACULTY', 'faculty-' || faculty_row.id)
      returning id into created_unit;
    update public.faculties set unit_id = created_unit where id = faculty_row.id;
  end loop;

  for department_row in
    select dep.*, fa.unit_id as parent
    from public.departments dep
    join public.faculties fa on fa.id = dep.faculty_id
    where dep.organization_id = p_organization_id and dep.unit_id is null
  loop
    insert into public.organization_units (organization_id, parent_unit_id, name, type, slug)
      values (
        p_organization_id,
        department_row.parent,
        department_row.name,
        'DEPARTMENT',
        'department-' || department_row.id
      ) returning id into created_unit;
    update public.departments set unit_id = created_unit where id = department_row.id;
  end loop;

  update public.courses course
    set unit_id = department.unit_id
    from public.departments department
    where course.department_id = department.id
      and course.organization_id = p_organization_id
      and course.unit_id is null;
  insert into public.unit_memberships (organization_id, unit_id, member_id, role, permissions)
    select distinct p_organization_id, queue.unit_id, assignment.business_member_id, 'STAFF', array['queue.serve']
    from public.queue_staff_assignments assignment
    join public.queues queue on queue.id = assignment.queue_id
    where queue.business_id = p_organization_id
    on conflict do nothing;
  insert into public.unit_memberships (organization_id, unit_id, member_id, role, permissions)
    select distinct
      p_organization_id,
      course.unit_id,
      member.id,
      'LECTURER',
      array['course.create', 'course.manage', 'attendance.start', 'attendance.manage', 'attendance.export']
    from public.course_lecturers lecturer
    join public.courses course on course.id = lecturer.course_id
    join public.business_members member
      on member.business_id = lecturer.organization_id
      and member.clerk_user_id = lecturer.clerk_user_id
    where course.organization_id = p_organization_id
    on conflict do nothing;
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (
      p_organization_id,
      'institution_configured',
      private.current_clerk_user_id(),
      jsonb_build_object('institution_type', p_type)
    );
end;
$$;

create function public.onboard_organization_workspace(
  p_request_id uuid,
  p_workspace_name text,
  p_organization_type public.organization_type,
  p_country_code text,
  p_timezone text,
  p_location_name text,
  p_location_address text
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id text := private.current_clerk_user_id();
  workspace_id uuid;
  location_id uuid;
  workspace_slug text;
  workspace_industry text;
  workspace_mode public.organization_mode;
begin
  if actor_id is null or char_length(actor_id) > 255 then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_request_id is null
    or p_organization_type is null
    or p_workspace_name is null
    or char_length(btrim(p_workspace_name)) not between 1 and 160
    or p_country_code is null
    or not (upper(btrim(p_country_code)) = any(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW', ' ')))
    or p_timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = btrim(p_timezone))
    or p_location_name is null
    or char_length(btrim(p_location_name)) not between 1 and 160
    or p_location_address is null
    or char_length(btrim(p_location_address)) not between 1 and 500
  then
    raise exception 'Invalid organization workspace details' using errcode = '22023';
  end if;

  workspace_industry := case p_organization_type
    when 'UNIVERSITY_SCHOOL' then 'education'
    when 'HOSPITAL_CLINIC' then 'healthcare'
    when 'BANK_FINANCIAL' then 'financial_services'
    when 'SALON_BARBERSHOP' then 'beauty_wellness'
    when 'GOVERNMENT_OFFICE' then 'public_services'
    when 'COMPANY_OTHER' then 'other'
  end;
  workspace_mode := case when p_organization_type = 'UNIVERSITY_SCHOOL' then 'SCHOOL' else 'BUSINESS' end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('turnmark:organization-workspace:' || actor_id || ':' || p_request_id::text, 0)
  );
  select b.id into workspace_id
  from public.businesses b
  where b.owner_user_id = actor_id
    and b.workspace_ownership = 'ORGANIZATION'
    and b.onboarding_request_id = p_request_id;
  if workspace_id is not null then
    return workspace_id;
  end if;

  workspace_slug := trim(both '-' from regexp_replace(lower(btrim(p_workspace_name)), '[^a-z0-9]+', '-', 'g'));
  workspace_slug := coalesce(nullif(rtrim(left(workspace_slug, 60), '-'), ''), 'organization')
    || '-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.businesses (
    name, slug, owner_user_id, industry, timezone, country_code,
    organization_mode, workspace_ownership, organization_type, onboarding_request_id
  ) values (
    btrim(p_workspace_name), workspace_slug, actor_id, workspace_industry,
    btrim(p_timezone), upper(btrim(p_country_code)), workspace_mode,
    'ORGANIZATION', p_organization_type, p_request_id
  ) returning id into workspace_id;

  insert into public.business_members (business_id, clerk_user_id, role)
    values (workspace_id, actor_id, 'owner');
  insert into public.locations (business_id, name, address, timezone)
    values (workspace_id, btrim(p_location_name), btrim(p_location_address), btrim(p_timezone))
    returning id into location_id;
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (
      workspace_id,
      'business_created',
      actor_id,
      jsonb_build_object('location_id', location_id, 'organization_type', p_organization_type)
    );

  if p_organization_type = 'UNIVERSITY_SCHOOL' then
    perform public.institution_setup(workspace_id, 'OTHER');
  end if;

  return workspace_id;
end;
$$;

revoke all on function public.onboard_organization_workspace(
  uuid, text, public.organization_type, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.onboard_organization_workspace(
  uuid, text, public.organization_type, text, text, text, text
) to authenticated;

commit;
