alter table public.queues
  add column if not exists service_name text,
  add column if not exists capacity integer,
  add column if not exists opens_at time without time zone,
  add column if not exists closes_at time without time zone;

update public.queues set service_name=name where service_name is null;
alter table public.queues alter column service_name set not null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='queues_service_name_length') then
    alter table public.queues add constraint queues_service_name_length
      check (char_length(btrim(service_name)) between 1 and 160);
  end if;
  if not exists(select 1 from pg_constraint where conname='queues_capacity_range') then
    alter table public.queues add constraint queues_capacity_range
      check (capacity is null or capacity between 1 and 1000);
  end if;
  if not exists(select 1 from pg_constraint where conname='queues_operating_hours_pair') then
    alter table public.queues add constraint queues_operating_hours_pair
      check ((opens_at is null and closes_at is null)
        or (opens_at is not null and closes_at is not null and opens_at<>closes_at));
  end if;
end
$$;

create or replace function private.queue_schedule_open(
  p_opens_at time without time zone,
  p_closes_at time without time zone,
  p_timezone text,
  p_at timestamptz
) returns boolean
language sql stable set search_path=''
as $$
  select case
    when p_opens_at is null or p_closes_at is null then true
    when p_opens_at < p_closes_at then
      (p_at at time zone p_timezone)::time >= p_opens_at
      and (p_at at time zone p_timezone)::time < p_closes_at
    else
      (p_at at time zone p_timezone)::time >= p_opens_at
      or (p_at at time zone p_timezone)::time < p_closes_at
  end
$$;
revoke all on function private.queue_schedule_open(time,time,text,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.create_queue_v2(
  p_queue_id uuid,p_business_id uuid,p_location_id uuid,p_name text,p_service_name text,
  p_description text,p_average_service_seconds integer,p_warning_threshold integer,
  p_allow_phone boolean,p_require_phone boolean,p_capacity integer,
  p_opens_at time without time zone,p_closes_at time without time zone,p_status public.queue_status
) returns uuid language plpgsql volatile security definer set search_path=''
as $$
declare actor_id text:=private.current_clerk_user_id();existing_business uuid;queue_slug text;
begin
  if actor_id is null or coalesce(private.business_role_for(p_business_id) not in ('owner','admin'),true)
    then raise exception 'Queue management access required' using errcode='42501'; end if;
  if p_queue_id is null or p_status is null then raise exception 'Queue ID and status required' using errcode='22023'; end if;
  if p_service_name is null or char_length(btrim(p_service_name)) not between 1 and 160
    or (p_capacity is not null and p_capacity not between 1 and 1000)
    or ((p_opens_at is null) <> (p_closes_at is null))
    or (p_opens_at is not null and p_opens_at=p_closes_at)
  then raise exception 'Invalid queue settings' using errcode='22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('queuezero:create:'||p_queue_id::text,0));
  perform private.lock_business_manager(p_business_id);
  select business_id into existing_business from public.queues where id=p_queue_id;
  if found then
    if existing_business<>p_business_id then raise exception 'Queue unavailable' using errcode='42501'; end if;
    return p_queue_id;
  end if;
  perform private.validate_queue_settings(p_name,p_description,p_average_service_seconds,p_warning_threshold,p_allow_phone,p_require_phone);
  perform 1 from public.locations where id=p_location_id and business_id=p_business_id and is_active for share;
  if not found then raise exception 'Choose an active location in this business' using errcode='22023'; end if;
  queue_slug:=trim(both '-' from regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'));
  queue_slug:=coalesce(nullif(rtrim(left(queue_slug,60),'-'),''),'queue')||'-'||replace(gen_random_uuid()::text,'-','');
  insert into public.queues(
    id,business_id,location_id,name,service_name,slug,description,status,
    average_service_seconds,warning_threshold,allow_phone,require_phone,capacity,opens_at,closes_at
  ) values(
    p_queue_id,p_business_id,p_location_id,btrim(p_name),btrim(p_service_name),queue_slug,
    nullif(btrim(p_description),''),p_status,p_average_service_seconds,p_warning_threshold,
    p_allow_phone,p_require_phone,p_capacity,p_opens_at,p_closes_at
  );
  insert into public.business_events(business_id,type,actor_user_id,metadata)
    values(p_business_id,'queue_created',actor_id,jsonb_build_object('queue_id',p_queue_id,'location_id',p_location_id,'status',p_status));
  return p_queue_id;
end
$$;
revoke all on function public.create_queue_v2(uuid,uuid,uuid,text,text,text,integer,integer,boolean,boolean,integer,time,time,public.queue_status)
  from public,anon,authenticated,service_role;
grant execute on function public.create_queue_v2(uuid,uuid,uuid,text,text,text,integer,integer,boolean,boolean,integer,time,time,public.queue_status)
  to authenticated;

create or replace function public.update_queue_v2(
  p_queue_id uuid,p_business_id uuid,p_expected_revision integer,p_location_id uuid,
  p_name text,p_service_name text,p_description text,p_average_service_seconds integer,
  p_warning_threshold integer,p_allow_phone boolean,p_require_phone boolean,p_capacity integer,
  p_opens_at time without time zone,p_closes_at time without time zone,p_status public.queue_status
) returns uuid language plpgsql volatile security definer set search_path=''
as $$
declare current_queue public.queues%rowtype;actor_id text:=private.current_clerk_user_id();
begin
  if actor_id is null or coalesce(private.business_role_for(p_business_id) not in ('owner','admin'),true)
    then raise exception 'Queue management access required' using errcode='42501'; end if;
  select * into current_queue from public.queues where id=p_queue_id and business_id=p_business_id for update;
  if not found then raise exception 'Queue unavailable' using errcode='42501'; end if;
  perform private.lock_business_manager(p_business_id);
  if p_expected_revision is distinct from current_queue.revision
    then raise exception 'Queue changed; reload before saving' using errcode='40001'; end if;
  perform private.validate_queue_settings(p_name,p_description,p_average_service_seconds,p_warning_threshold,p_allow_phone,p_require_phone);
  if p_service_name is null or char_length(btrim(p_service_name)) not between 1 and 160
    or (p_capacity is not null and p_capacity not between 1 and 1000)
    or ((p_opens_at is null) <> (p_closes_at is null))
    or (p_opens_at is not null and p_opens_at=p_closes_at)
    or p_status is null
  then raise exception 'Invalid queue settings' using errcode='22023'; end if;
  perform 1 from public.locations where id=p_location_id and business_id=p_business_id and is_active for share;
  if not found then raise exception 'Choose an active location in this business' using errcode='22023'; end if;
  update public.queues set
    location_id=p_location_id,name=btrim(p_name),service_name=btrim(p_service_name),
    description=nullif(btrim(p_description),''),average_service_seconds=p_average_service_seconds,
    warning_threshold=p_warning_threshold,allow_phone=p_allow_phone,require_phone=p_require_phone,
    capacity=p_capacity,opens_at=p_opens_at,closes_at=p_closes_at,status=p_status
  where id=p_queue_id;
  insert into public.business_events(business_id,type,actor_user_id,metadata)
    values(p_business_id,'queue_updated',actor_id,jsonb_build_object('queue_id',p_queue_id,'revision',current_queue.revision+1));
  if current_queue.status is distinct from p_status then
    insert into public.business_events(business_id,type,actor_user_id,metadata)
      values(p_business_id,'queue_status_changed',actor_id,jsonb_build_object('queue_id',p_queue_id,'status',p_status));
  end if;
  return p_queue_id;
end
$$;
revoke all on function public.update_queue_v2(uuid,uuid,integer,uuid,text,text,text,integer,integer,boolean,boolean,integer,time,time,public.queue_status)
  from public,anon,authenticated,service_role;
grant execute on function public.update_queue_v2(uuid,uuid,integer,uuid,text,text,text,integer,integer,boolean,boolean,integer,time,time,public.queue_status)
  to authenticated;

create or replace function public.get_public_queue_v2(p_slug text)
returns table(
  slug text,business_name text,business_logo_url text,queue_name text,service_name text,
  description text,location_name text,status public.queue_status,is_full boolean,
  waiting_count bigint,estimated_wait_seconds bigint,has_serving_customer boolean
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if p_slug is null or char_length(p_slug) not between 3 and 100
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return; end if;
  return query
  with base as (
    select q.*,b.name as business_name_value,b.logo_url,l.name as location_name_value,l.timezone,
      (select count(*) from public.tickets t where t.queue_id=q.id and t.status='waiting') as waiting_total,
      (select count(*) from public.tickets t where t.queue_id=q.id and t.status in ('waiting','serving')) as active_total,
      exists(select 1 from public.tickets t where t.queue_id=q.id and t.status='serving') as has_serving
    from public.queues q join public.businesses b on b.id=q.business_id
    join public.locations l on l.id=q.location_id and l.business_id=q.business_id and l.is_active
    where q.slug=p_slug
  )
  select base.slug,base.business_name_value,base.logo_url,base.name,base.service_name,base.description,
    base.location_name_value,
    case
      when base.status<>'open' then base.status
      when not private.queue_schedule_open(base.opens_at,base.closes_at,base.timezone,clock_timestamp()) then 'closed'::public.queue_status
      when base.active_total>=coalesce(base.capacity,1000) then 'paused'::public.queue_status
      else 'open'::public.queue_status
    end,
    base.active_total>=coalesce(base.capacity,1000),
    base.waiting_total,
    case
      when base.status='open'
       and private.queue_schedule_open(base.opens_at,base.closes_at,base.timezone,clock_timestamp())
       and base.active_total<coalesce(base.capacity,1000)
      then base.waiting_total*private.queue_service_seconds(base.id)::bigint else null::bigint
    end,
    base.has_serving
  from base;
end
$$;
revoke all on function public.get_public_queue_v2(text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_queue_v2(text) to anon,authenticated;

create or replace function public.get_public_join_options_v2(p_slug text)
returns table(
  slug text,business_name text,queue_name text,service_name text,status public.queue_status,
  is_full boolean,allow_phone boolean,require_phone boolean
)
language sql stable security definer set search_path=''
as $$
  with base as (
    select q.*,b.name as business_name_value,l.timezone,
      (select count(*) from public.tickets t where t.queue_id=q.id and t.status in ('waiting','serving')) as active_total
    from public.queues q join public.businesses b on b.id=q.business_id
    join public.locations l on l.id=q.location_id and l.business_id=q.business_id and l.is_active
    where char_length(p_slug) between 3 and 100 and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and q.slug=p_slug
  )
  select base.slug,base.business_name_value,base.name,base.service_name,
    case
      when base.status<>'open' then base.status
      when not private.queue_schedule_open(base.opens_at,base.closes_at,base.timezone,clock_timestamp()) then 'closed'::public.queue_status
      when base.active_total>=coalesce(base.capacity,1000) then 'paused'::public.queue_status
      else 'open'::public.queue_status
    end,
    base.active_total>=coalesce(base.capacity,1000),
    base.allow_phone,base.require_phone
  from base
$$;
revoke all on function public.get_public_join_options_v2(text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_join_options_v2(text) to anon,authenticated;

create or replace function public.join_public_queue_v2(
  p_slug text,p_request_id uuid,p_customer_key text,p_rate_key text,p_customer_name text,p_phone text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  q public.queues%rowtype;existing_request public.queue_join_requests%rowtype;
  active_ticket public.tickets%rowtype;location_timezone text;location_active boolean;active_total bigint;
begin
  if p_slug is null or char_length(p_slug) not between 3 and 100 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_request_id is null or p_customer_key is null or p_customer_key !~ '^[a-f0-9]{64}$'
    or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$'
  then raise exception 'Invalid join request' using errcode='22023'; end if;

  select * into q from public.queues where slug=p_slug for update;
  if not found then raise exception 'Queue unavailable' using errcode='QZ001'; end if;

  select * into existing_request from public.queue_join_requests where id=p_request_id;
  if found then return public.join_public_queue(p_slug,p_request_id,p_customer_key,p_rate_key,p_customer_name,p_phone); end if;

  select * into active_ticket from public.tickets
    where queue_id=q.id and customer_key=p_customer_key and status in ('waiting','serving');
  if found then return public.join_public_queue(p_slug,p_request_id,p_customer_key,p_rate_key,p_customer_name,p_phone); end if;

  select timezone,is_active into location_timezone,location_active from public.locations
    where id=q.location_id and business_id=q.business_id for share;
  if not found or not location_active then raise exception 'Queue unavailable' using errcode='QZ001'; end if;

  if q.status<>'open' or not private.queue_schedule_open(q.opens_at,q.closes_at,location_timezone,clock_timestamp())
    then raise exception 'Queue is not open' using errcode='QZ002'; end if;

  select count(*) into active_total from public.tickets where queue_id=q.id and status in ('waiting','serving');
  if active_total>=coalesce(q.capacity,1000) then raise exception 'Queue is at capacity' using errcode='QZ004'; end if;

  return public.join_public_queue(p_slug,p_request_id,p_customer_key,p_rate_key,p_customer_name,p_phone);
end
$$;
revoke all on function public.join_public_queue_v2(text,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.join_public_queue_v2(text,uuid,text,text,text,text) to service_role;
