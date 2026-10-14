begin;
alter type public.professional_category add value if not exists 'DOCTOR';
alter type public.professional_category add value if not exists 'NURSE';
alter type public.professional_category add value if not exists 'BANKER';
alter type public.professional_category add value if not exists 'BARBER_STYLIST';
alter type public.professional_category add value if not exists 'CONSULTANT';
alter type public.professional_category add value if not exists 'OTHER_PROFESSIONAL';
commit;

begin;

alter table public.businesses
  add constraint businesses_id_professional_category_unique unique (id, professional_category);

create table public.professional_workspace_profiles (
  business_id uuid primary key,
  professional_category public.professional_category not null,
  teaching_level text check (teaching_level is null or char_length(btrim(teaching_level)) between 1 and 100),
  institution_name text check (institution_name is null or char_length(btrim(institution_name)) between 1 and 160),
  service_name text check (service_name is null or char_length(btrim(service_name)) between 1 and 160),
  practice_location_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, professional_category)
    references public.businesses (id, professional_category) on delete restrict,
  foreign key (practice_location_id, business_id)
    references public.locations (id, business_id) on delete restrict,
  check (
    (professional_category = 'LECTURER_TEACHER'
      and teaching_level is not null
      and service_name is null
      and practice_location_id is null)
    or
    (professional_category <> 'LECTURER_TEACHER'
      and teaching_level is null
      and institution_name is null
      and service_name is not null
      and practice_location_id is not null)
  )
);

comment on table public.professional_workspace_profiles is
  'Minimal operational configuration for individually owned professional workspaces. Institution names are descriptive only and never grant authorization.';
comment on column public.professional_workspace_profiles.institution_name is
  'Optional lecturer-provided context. It does not represent or verify institutional affiliation.';

create trigger professional_workspace_profiles_updated_at
  before update on public.professional_workspace_profiles
  for each row execute function private.set_updated_at();

alter table public.professional_workspace_profiles enable row level security;
alter table public.professional_workspace_profiles force row level security;
revoke all on public.professional_workspace_profiles from public, anon, authenticated, service_role;
grant select on public.professional_workspace_profiles to authenticated;
grant select, insert, update on public.professional_workspace_profiles to service_role;
create policy professional_workspace_profiles_member_read
  on public.professional_workspace_profiles for select to authenticated
  using (private.business_role_for(business_id) is not null);

create function public.onboard_professional_workspace_v2(
  p_workspace_name text,
  p_professional_category public.professional_category,
  p_country_code text,
  p_timezone text,
  p_teaching_level text default null,
  p_institution_name text default null,
  p_service_name text default null,
  p_location_name text default null,
  p_location_address text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id text := private.current_clerk_user_id();
  workspace_id uuid;
  location_id uuid;
  workspace_slug text;
  workspace_industry text;
  workspace_mode public.organization_mode;
  teaching_level text := nullif(btrim(p_teaching_level), '');
  institution_name text := nullif(btrim(p_institution_name), '');
  service_name text := nullif(btrim(p_service_name), '');
  location_name text := nullif(btrim(p_location_name), '');
  location_address text := nullif(btrim(p_location_address), '');
begin
  if actor_id is null or char_length(actor_id) > 255 then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_professional_category is null
    or p_workspace_name is null
    or char_length(btrim(p_workspace_name)) not between 1 and 160
    or p_country_code is null
    or not (upper(btrim(p_country_code)) = any(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW', ' ')))
    or p_timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = btrim(p_timezone))
    or (institution_name is not null and char_length(institution_name) > 160)
  then
    raise exception 'Invalid professional workspace details' using errcode = '22023';
  end if;

  if p_professional_category = 'LECTURER_TEACHER' then
    if teaching_level is null or char_length(teaching_level) > 100
      or service_name is not null or location_name is not null or location_address is not null
    then
      raise exception 'Invalid teaching workspace details' using errcode = '22023';
    end if;
    workspace_industry := 'education';
    workspace_mode := 'SCHOOL';
  else
    if teaching_level is not null or institution_name is not null
      or service_name is null or char_length(service_name) > 160
      or location_name is null or char_length(location_name) > 160
      or location_address is null or char_length(location_address) > 500
    then
      raise exception 'Invalid service workspace details' using errcode = '22023';
    end if;
    workspace_industry := case p_professional_category
      when 'DOCTOR' then 'healthcare'
      when 'NURSE' then 'healthcare'
      when 'BANKER' then 'financial_services'
      when 'BARBER_STYLIST' then 'beauty_wellness'
      else 'other'
    end;
    workspace_mode := 'BUSINESS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'turnmark:professional-workspace:' || actor_id || ':' || p_professional_category::text,
      0
    )
  );
  select b.id into workspace_id
  from public.businesses b
  where b.owner_user_id = actor_id
    and b.workspace_ownership = 'INDIVIDUAL'
    and b.professional_category = p_professional_category
  order by b.created_at, b.id
  limit 1;
  if workspace_id is not null
    and exists (select 1 from public.professional_workspace_profiles p where p.business_id = workspace_id)
  then
    return workspace_id;
  end if;

  if workspace_id is null then
    workspace_slug := trim(both '-' from regexp_replace(lower(btrim(p_workspace_name)), '[^a-z0-9]+', '-', 'g'));
    workspace_slug := coalesce(nullif(rtrim(left(workspace_slug, 60), '-'), ''), 'professional-workspace')
      || '-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.businesses (
      name, slug, owner_user_id, industry, timezone, country_code,
      organization_mode, workspace_ownership, professional_category
    ) values (
      btrim(p_workspace_name), workspace_slug, actor_id, workspace_industry,
      btrim(p_timezone), upper(btrim(p_country_code)), workspace_mode,
      'INDIVIDUAL', p_professional_category
    ) returning id into workspace_id;
    insert into public.business_members (business_id, clerk_user_id, role)
      values (workspace_id, actor_id, 'owner');
    insert into public.business_events (business_id, type, actor_user_id, metadata)
      values (
        workspace_id,
        'professional_workspace_created',
        actor_id,
        jsonb_build_object('professional_category', p_professional_category)
      );
  end if;

  if p_professional_category <> 'LECTURER_TEACHER' then
    insert into public.locations (business_id, name, address, timezone)
      values (workspace_id, location_name, location_address, btrim(p_timezone))
      returning id into location_id;
  end if;
  insert into public.professional_workspace_profiles (
    business_id, professional_category, teaching_level, institution_name,
    service_name, practice_location_id
  ) values (
    workspace_id, p_professional_category, teaching_level, institution_name,
    service_name, location_id
  );
  return workspace_id;
end;
$$;

revoke all on function public.onboard_professional_workspace_v2(
  text, public.professional_category, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.onboard_professional_workspace_v2(
  text, public.professional_category, text, text, text, text, text, text, text
) to authenticated;

commit;
