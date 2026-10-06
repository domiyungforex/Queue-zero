-- Optional queue capacity means no queue-specific limit.
-- Replace the temporary coalesce(capacity, 1000) behavior introduced by core_queue_fields_v2.

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
    from public.queues q
    join public.businesses b on b.id=q.business_id
    join public.locations l on l.id=q.location_id and l.business_id=q.business_id and l.is_active
    where q.slug=p_slug
  )
  select base.slug,base.business_name_value,base.logo_url,base.name,base.service_name,
    base.description,base.location_name_value,
    case
      when base.status<>'open' then base.status
      when not private.queue_schedule_open(base.opens_at,base.closes_at,base.timezone,clock_timestamp()) then 'closed'::public.queue_status
      when base.capacity is not null and base.active_total>=base.capacity then 'paused'::public.queue_status
      else 'open'::public.queue_status
    end,
    (base.capacity is not null and base.active_total>=base.capacity),
    base.waiting_total,
    case
      when base.status='open'
       and private.queue_schedule_open(base.opens_at,base.closes_at,base.timezone,clock_timestamp())
       and (base.capacity is null or base.active_total<base.capacity)
      then base.waiting_total*private.queue_service_seconds(base.id)::bigint
      else null::bigint
    end,
    base.has_serving
  from base;
end
$$;

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
    from public.queues q
    join public.businesses b on b.id=q.business_id
    join public.locations l on l.id=q.location_id and l.business_id=q.business_id and l.is_active
    where char_length(p_slug) between 3 and 100
      and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and q.slug=p_slug
  )
  select base.slug,base.business_name_value,base.name,base.service_name,
    case
      when base.status<>'open' then base.status
      when not private.queue_schedule_open(base.opens_at,base.closes_at,base.timezone,clock_timestamp()) then 'closed'::public.queue_status
      when base.capacity is not null and base.active_total>=base.capacity then 'paused'::public.queue_status
      else 'open'::public.queue_status
    end,
    (base.capacity is not null and base.active_total>=base.capacity),
    base.allow_phone,base.require_phone
  from base
$$;

create or replace function public.join_public_queue_v2(
  p_slug text,p_request_id uuid,p_customer_key text,p_rate_key text,p_customer_name text,p_phone text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  q public.queues%rowtype;
  existing_request public.queue_join_requests%rowtype;
  active_ticket public.tickets%rowtype;
  location_timezone text;
  location_active boolean;
  active_total bigint;
begin
  if p_slug is null or char_length(p_slug) not between 3 and 100 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_request_id is null or p_customer_key is null or p_customer_key !~ '^[a-f0-9]{64}$'
    or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$'
  then raise exception 'Invalid join request' using errcode='22023'; end if;

  select * into q from public.queues where slug=p_slug for update;
  if not found then raise exception 'Queue unavailable' using errcode='QZ001'; end if;

  select * into existing_request from public.queue_join_requests where id=p_request_id;
  if found then
    return public.join_public_queue(p_slug,p_request_id,p_customer_key,p_rate_key,p_customer_name,p_phone);
  end if;

  select * into active_ticket from public.tickets
  where queue_id=q.id and customer_key=p_customer_key and status in ('waiting','serving');
  if found then
    return public.join_public_queue(p_slug,p_request_id,p_customer_key,p_rate_key,p_customer_name,p_phone);
  end if;

  select timezone,is_active into location_timezone,location_active
  from public.locations where id=q.location_id and business_id=q.business_id for share;
  if not found or not location_active then raise exception 'Queue unavailable' using errcode='QZ001'; end if;

  if q.status<>'open'
    or not private.queue_schedule_open(q.opens_at,q.closes_at,location_timezone,clock_timestamp())
  then raise exception 'Queue is not open' using errcode='QZ002'; end if;

  if q.capacity is not null then
    select count(*) into active_total from public.tickets
    where queue_id=q.id and status in ('waiting','serving');
    if active_total>=q.capacity then
      raise exception 'Queue is at capacity' using errcode='QZ004';
    end if;
  end if;

  return public.join_public_queue(p_slug,p_request_id,p_customer_key,p_rate_key,p_customer_name,p_phone);
end
$$;
