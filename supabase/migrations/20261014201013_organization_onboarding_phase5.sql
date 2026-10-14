begin;

create type public.organization_verification_status as enum (
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

alter table public.businesses
  add constraint businesses_id_organization_type_unique unique (id, organization_type);

create table public.organization_workspace_profiles (
  business_id uuid primary key,
  organization_type public.organization_type not null,
  organization_subtype text not null check (char_length(organization_subtype) between 2 and 50),
  legal_name text not null check (char_length(btrim(legal_name)) between 1 and 200),
  authorized_representative_name text check (
    authorized_representative_name is null
    or char_length(btrim(authorized_representative_name)) between 1 and 160
  ),
  service_templates text[] not null default '{}',
  verification_status public.organization_verification_status not null default 'UNVERIFIED',
  setup_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, organization_type)
    references public.businesses (id, organization_type) on delete restrict,
  check (cardinality(service_templates) <= 12 and array_position(service_templates, null) is null),
  check (
    case organization_type
      when 'UNIVERSITY_SCHOOL' then
        organization_subtype in ('UNIVERSITY','SCHOOL','POLYTECHNIC','COLLEGE','TRAINING_INSTITUTION','OTHER')
        and service_templates <@ array['STUDENT_SERVICES','ADMISSIONS','BURSARY','LIBRARY','MEDICAL_CENTRE','DEPARTMENT_OFFICE']::text[]
      when 'HOSPITAL_CLINIC' then
        organization_subtype in ('HOSPITAL','CLINIC')
        and service_templates <@ array['RECEPTION','CONSULTATION','LABORATORY','PHARMACY_PICKUP']::text[]
      when 'BANK_FINANCIAL' then
        organization_subtype in ('COMMERCIAL_BANK','MICROFINANCE_BANK','CREDIT_UNION','OTHER_FINANCIAL')
        and authorized_representative_name is not null
        and service_templates <@ array['CUSTOMER_SERVICE','ACCOUNT_OPENING','DEPOSITS','WITHDRAWALS','CARD_SERVICES','LOAN_ENQUIRIES','COMPLAINTS','DOCUMENT_VERIFICATION']::text[]
      when 'SALON_BARBERSHOP' then
        organization_subtype in ('SALON','BARBERSHOP','SALON_BARBERSHOP')
        and service_templates <@ array['WALK_IN_SERVICE']::text[]
      when 'GOVERNMENT_OFFICE' then
        organization_subtype in ('GOVERNMENT_AGENCY','PUBLIC_OFFICE')
        and service_templates <@ array['GENERAL_ENQUIRIES','DOCUMENT_SERVICES','PAYMENTS','COMPLAINTS']::text[]
      when 'COMPANY_OTHER' then
        organization_subtype in ('COMPANY','OTHER_ORGANIZATION')
        and service_templates <@ array['CUSTOM_SERVICE']::text[]
    end
  )
);

comment on table public.organization_workspace_profiles is
  'Self-declared organization onboarding configuration. Templates are setup preferences and never create queues automatically.';
comment on column public.organization_workspace_profiles.verification_status is
  'Server-controlled affiliation review state. Client onboarding never verifies an organization.';

create trigger organization_workspace_profiles_updated_at
  before update on public.organization_workspace_profiles
  for each row execute function private.set_updated_at();

alter table public.organization_workspace_profiles enable row level security;
alter table public.organization_workspace_profiles force row level security;
revoke all on public.organization_workspace_profiles from public, anon, authenticated, service_role;
grant select on public.organization_workspace_profiles to authenticated;
grant select, insert, update on public.organization_workspace_profiles to service_role;
create policy organization_workspace_profiles_member_read
  on public.organization_workspace_profiles for select to authenticated
  using (private.business_role_for(business_id) is not null);

create function public.onboard_organization_workspace_v2(
  p_request_id uuid,
  p_workspace_name text,
  p_organization_type public.organization_type,
  p_organization_subtype text,
  p_legal_name text,
  p_authorized_representative_name text,
  p_service_templates text[],
  p_country_code text,
  p_timezone text,
  p_location_name text,
  p_location_address text
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  workspace_id uuid;
  normalized_templates text[];
  representative_name text := nullif(btrim(p_authorized_representative_name), '');
  target_institution_type text;
begin
  if p_organization_subtype is null
    or p_legal_name is null
    or char_length(btrim(p_legal_name)) not between 1 and 200
    or (representative_name is not null and char_length(representative_name) > 160)
    or p_service_templates is null
    or cardinality(p_service_templates) > 12
    or array_position(p_service_templates, null) is not null
  then
    raise exception 'Invalid organization profile details' using errcode = '22023';
  end if;

  select coalesce(array_agg(template order by template), '{}') into normalized_templates
  from (select distinct upper(btrim(item)) as template from unnest(p_service_templates) item) templates;

  -- The constrained profile insert below remains the authoritative category
  -- validation. This RPC supplies ownership and idempotency through the
  -- existing organization workspace operation.
  workspace_id := public.onboard_organization_workspace(
    p_request_id,
    p_workspace_name,
    p_organization_type,
    p_country_code,
    p_timezone,
    p_location_name,
    p_location_address
  );

  if exists (
    select 1 from public.organization_workspace_profiles profile
    where profile.business_id = workspace_id
  ) then
    return workspace_id;
  end if;

  if p_organization_type = 'UNIVERSITY_SCHOOL' then
    target_institution_type := case upper(btrim(p_organization_subtype))
      when 'UNIVERSITY' then 'UNIVERSITY'
      when 'POLYTECHNIC' then 'POLYTECHNIC'
      when 'COLLEGE' then 'COLLEGE'
      when 'SCHOOL' then 'SECONDARY_SCHOOL'
      when 'TRAINING_INSTITUTION' then 'TRAINING_INSTITUTION'
      else 'OTHER'
    end;
    update public.businesses set institution_type = target_institution_type
      where id = workspace_id;
  end if;

  insert into public.organization_workspace_profiles (
    business_id,
    organization_type,
    organization_subtype,
    legal_name,
    authorized_representative_name,
    service_templates
  ) values (
    workspace_id,
    p_organization_type,
    upper(btrim(p_organization_subtype)),
    btrim(p_legal_name),
    representative_name,
    normalized_templates
  );

  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (
      workspace_id,
      'organization_profile_created',
      private.current_clerk_user_id(),
      jsonb_build_object(
        'organization_type', p_organization_type,
        'organization_subtype', upper(btrim(p_organization_subtype)),
        'verification_status', 'UNVERIFIED'
      )
    );
  return workspace_id;
exception
  when check_violation then
    raise exception 'Invalid organization profile details' using errcode = '22023';
end;
$$;

revoke all on function public.onboard_organization_workspace_v2(
  uuid, text, public.organization_type, text, text, text, text[], text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.onboard_organization_workspace_v2(
  uuid, text, public.organization_type, text, text, text, text[], text, text, text, text
) to authenticated;

-- Banks can prepare queue settings while affiliation review is pending, but
-- their queues remain paused until a trusted backend records VERIFIED.
create function private.enforce_official_queue_activation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'open'
    and exists (
      select 1 from public.businesses business
      where business.id = new.business_id
        and business.organization_type = 'BANK_FINANCIAL'
    )
    and not exists (
      select 1 from public.organization_workspace_profiles profile
      where profile.business_id = new.business_id
        and profile.organization_type = 'BANK_FINANCIAL'
        and profile.verification_status = 'VERIFIED'
    )
  then
    if tg_op = 'INSERT' then
      new.status := 'paused';
    else
      raise exception 'Organization verification required before public activation' using errcode = 'QZ010';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_official_queue_activation() from public, anon, authenticated, service_role;
create trigger enforce_official_queue_activation
  before insert or update of status on public.queues
  for each row execute function private.enforce_official_queue_activation();

update public.queues queue
set status = 'paused'
where queue.status = 'open'
  and exists (
    select 1 from public.businesses business
    where business.id = queue.business_id
      and business.organization_type = 'BANK_FINANCIAL'
  )
  and not exists (
    select 1 from public.organization_workspace_profiles profile
    where profile.business_id = queue.business_id
      and profile.verification_status = 'VERIFIED'
  );

-- This shared table is not owned by TuRnMaRk. If present, close the reported
-- browser-role exposure without altering its data or inventing access policies.
do $$
begin
  if to_regclass('public."Conversation"') is not null then
    alter table public."Conversation" enable row level security;
    alter table public."Conversation" force row level security;
    revoke all privileges on table public."Conversation" from public, anon, authenticated;
  end if;
end;
$$;

commit;
