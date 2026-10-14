begin;

create type public.workspace_ownership as enum ('ORGANIZATION', 'INDIVIDUAL');
create type public.professional_category as enum ('LECTURER_TEACHER');

alter table public.businesses
  add column workspace_ownership public.workspace_ownership not null default 'ORGANIZATION',
  add column professional_category public.professional_category,
  add constraint businesses_workspace_ownership_check check (
    (workspace_ownership = 'ORGANIZATION' and professional_category is null)
    or
    (workspace_ownership = 'INDIVIDUAL' and professional_category is not null and institution_type is null)
  );

create unique index businesses_one_personal_professional_workspace
  on public.businesses (owner_user_id, professional_category)
  where workspace_ownership = 'INDIVIDUAL';

comment on column public.businesses.workspace_ownership is
  'Distinguishes workspaces representing an organization from workspaces owned by an individual professional.';
comment on column public.businesses.professional_category is
  'Professional category for individually owned workspaces. Null for organization-owned workspaces.';

create function public.onboard_professional_workspace(
  p_workspace_name text,
  p_professional_category public.professional_category,
  p_country_code text,
  p_timezone text
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id text := private.current_clerk_user_id();
  workspace_id uuid;
  workspace_slug text;
begin
  if actor_id is null or char_length(actor_id) > 255 then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_professional_category is distinct from 'LECTURER_TEACHER'::public.professional_category
    or p_workspace_name is null
    or char_length(btrim(p_workspace_name)) not between 1 and 160
    or p_country_code is null
    or not (upper(btrim(p_country_code)) = any(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW', ' ')))
    or p_timezone is null
    or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = btrim(p_timezone)
    )
  then
    raise exception 'Invalid professional workspace details' using errcode = '22023';
  end if;

  -- One workspace per professional category is deliberate for Phase 1. The
  -- lock keeps retries and simultaneous requests idempotent across app nodes.
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
  if workspace_id is not null then
    return workspace_id;
  end if;

  workspace_slug := trim(both '-' from regexp_replace(lower(btrim(p_workspace_name)), '[^a-z0-9]+', '-', 'g'));
  workspace_slug := coalesce(nullif(rtrim(left(workspace_slug, 60), '-'), ''), 'teaching-workspace')
    || '-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.businesses (
    name,
    slug,
    owner_user_id,
    industry,
    timezone,
    country_code,
    organization_mode,
    workspace_ownership,
    professional_category
  ) values (
    btrim(p_workspace_name),
    workspace_slug,
    actor_id,
    'education',
    btrim(p_timezone),
    upper(btrim(p_country_code)),
    'SCHOOL',
    'INDIVIDUAL',
    p_professional_category
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

  return workspace_id;
end;
$$;

revoke all on function public.onboard_professional_workspace(
  text,
  public.professional_category,
  text,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.onboard_professional_workspace(
  text,
  public.professional_category,
  text,
  text
) to authenticated;

commit;
