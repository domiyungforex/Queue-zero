begin;

create table public.business_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  type text not null check (type ~ '^[a-z][a-z_]{2,79}$'),
  actor_user_id text not null check (char_length(btrim(actor_user_id)) between 1 and 255),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index business_events_history on public.business_events (business_id, created_at);
alter table public.business_events enable row level security;
alter table public.business_events force row level security;
revoke all on public.business_events from public, anon, authenticated, service_role;
grant select on public.business_events to authenticated;
grant select, insert on public.business_events to service_role;
create policy business_events_manager_read on public.business_events for select to authenticated
  using (private.business_role_for(business_id) in ('owner', 'admin'));

create function private.reject_business_event_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Business events are append-only' using errcode = '55000';
end;
$$;
revoke all on function private.reject_business_event_mutation() from public, anon, authenticated;
create trigger business_events_immutable before update or delete on public.business_events
  for each row execute function private.reject_business_event_mutation();

create function public.onboard_business(
  p_business_name text,
  p_industry text,
  p_country_code text,
  p_timezone text,
  p_location_name text,
  p_location_address text
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id text := private.current_clerk_user_id();
  business_id uuid;
  location_id uuid;
  business_slug text;
begin
  if actor_id is null or char_length(actor_id) > 255 then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- This is a first-business operation. Serialize even requests from different
  -- app instances; a second transaction rechecks membership after the first commits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('queuezero:onboarding:' || actor_id, 0));
  select m.business_id into business_id from public.business_members m
    where m.clerk_user_id = actor_id order by m.created_at, m.id limit 1;
  if business_id is not null then return business_id; end if;

  -- Validate here as well: authenticated users may invoke this RPC directly.
  if p_business_name is null or char_length(btrim(p_business_name)) not between 1 and 160
    or p_industry is null or btrim(p_industry) not in ('healthcare', 'beauty_wellness', 'retail', 'public_services', 'financial_services', 'hospitality', 'education', 'other')
    or p_country_code is null or not (upper(btrim(p_country_code)) = any(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW', ' ')))
    or p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = btrim(p_timezone))
    or p_location_name is null or char_length(btrim(p_location_name)) not between 1 and 160
    or p_location_address is null or char_length(btrim(p_location_address)) not between 1 and 500
  then
    raise exception 'Invalid business or location details' using errcode = '22023';
  end if;

  -- A separate random suffix avoids slug collisions without exposing the row ID.
  business_slug := trim(both '-' from regexp_replace(lower(btrim(p_business_name)), '[^a-z0-9]+', '-', 'g'));
  business_slug := coalesce(nullif(rtrim(left(business_slug, 60), '-'), ''), 'business')
    || '-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.businesses (name, slug, owner_user_id, industry, country_code, timezone)
    values (btrim(p_business_name), business_slug, actor_id, btrim(p_industry), upper(btrim(p_country_code)), btrim(p_timezone))
    returning id into business_id;
  insert into public.business_members (business_id, clerk_user_id, role)
    values (business_id, actor_id, 'owner');
  insert into public.locations (business_id, name, address, timezone)
    values (business_id, btrim(p_location_name), btrim(p_location_address), btrim(p_timezone))
    returning id into location_id;
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (business_id, 'business_created', actor_id, jsonb_build_object('location_id', location_id));

  return business_id;
end;
$$;

revoke all on function public.onboard_business(text, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.onboard_business(text, text, text, text, text, text) to authenticated;

commit;
