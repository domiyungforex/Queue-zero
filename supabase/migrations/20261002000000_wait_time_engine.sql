begin;

-- All estimates use the same bounded history; reads do not write learned state
-- or increment queue configuration revisions. Single serving capacity remains 1.
create function private.queue_service_seconds(p_queue_id uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  configured integer;
  durations double precision[];
  average double precision;
  duration double precision;
begin
  select average_service_seconds into configured from public.queues where id=p_queue_id;
  if not found then return null; end if;
  select array_agg(sample.duration order by sample.completed_at, sample.id) into durations
  from (
    select t.id,t.completed_at,
      greatest(1,least(86400,extract(epoch from (t.completed_at-t.called_at))))::double precision as duration
    from public.tickets t
    where t.queue_id=p_queue_id and t.status='completed' and t.completed_at>t.called_at
    order by t.completed_at desc,t.id desc limit 20
  ) sample;
  if coalesce(cardinality(durations),0)<5 then return configured; end if;
  average := configured;
  foreach duration in array durations loop
    average := 0.25*duration+0.75*average;
  end loop;
  return ceil(average)::integer;
end;
$$;
revoke all on function private.queue_service_seconds(uuid) from public,anon,authenticated,service_role;

-- Preserve every public projection and existing privilege boundary.
create or replace function public.get_public_queue(p_slug text)
returns table (
  slug text,
  business_name text,
  business_logo_url text,
  queue_name text,
  description text,
  location_name text,
  status public.queue_status,
  waiting_count bigint,
  estimated_wait_seconds bigint,
  has_serving_customer boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_slug is null or char_length(p_slug) not between 3 and 100
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then return; end if;

  return query
    select q.slug, b.name, b.logo_url, q.name, q.description, l.name, q.status,
      waiting.total,
      case when q.status = 'open' then waiting.total * private.queue_service_seconds(q.id)::bigint else null::bigint end,
      exists(select 1 from public.tickets serving where serving.queue_id = q.id and serving.status = 'serving')
    from public.queues q
    join public.businesses b on b.id = q.business_id
    join public.locations l on l.id = q.location_id and l.business_id = q.business_id and l.is_active
    cross join lateral (
      -- Include every active waiting ticket, including those joined before midnight.
      -- The existing tickets_waiting_order partial index covers this aggregate.
      select count(*) as total from public.tickets t where t.queue_id = q.id and t.status = 'waiting'
    ) waiting
    where q.slug = p_slug;
end;
$$;

create or replace function public.get_public_ticket(p_token uuid)
returns table(
  display_number text, status public.ticket_status, joined_at timestamptz,
  business_name text, queue_name text, queue_slug text, location_name text,
  location_timezone text, queue_status public.queue_status, location_active boolean,
  people_ahead bigint, estimated_wait_seconds bigint, has_serving_customer boolean
)
language sql stable security definer set search_path = '' as $$
  select t.display_number,t.status,t.joined_at,b.name,q.name,q.slug,l.name,l.timezone,q.status,l.is_active,
    case when t.status='waiting' then position.ahead else null end,
    case when t.status='waiting' and q.status='open' and l.is_active
      then position.ahead*private.queue_service_seconds(q.id) else null end,
    exists(select 1 from public.tickets s where s.queue_id=q.id and s.status='serving')
  from public.tickets t
  join public.queues q on q.id=t.queue_id
  join public.businesses b on b.id=q.business_id
  join public.locations l on l.id=q.location_id and l.business_id=q.business_id
  cross join lateral (
    select count(*) as ahead from public.tickets w
    where w.queue_id=t.queue_id and w.status='waiting' and (w.joined_at,w.id)<(t.joined_at,t.id)
  ) position
  where t.public_token=p_token;
$$;
create or replace function public.join_public_queue(
  p_slug text, p_request_id uuid, p_customer_key text, p_rate_key text,
  p_customer_name text, p_phone text
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  q public.queues%rowtype;
  existing_request public.queue_join_requests%rowtype;
  chosen_ticket public.tickets%rowtype;
  location_timezone text;
  location_active boolean;
  joined_time timestamptz;
  local_date date;
  next_number integer;
  waiting_total bigint;
  active_total bigint;
  normalized_phone text;
  rate_joins integer;
begin
  if p_slug is null or char_length(p_slug) not between 3 and 100 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_request_id is null or p_customer_key is null or p_customer_key !~ '^[a-f0-9]{64}$'
    or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$'
  then raise exception 'Invalid join request' using errcode='22023'; end if;

  -- Coordinate with pause/close/edit and all future ticket operations.
  select * into q from public.queues where slug=p_slug for update;
  if not found then raise exception 'Queue unavailable' using errcode='QZ001'; end if;

  select * into existing_request from public.queue_join_requests where id=p_request_id;
  if found then
    if existing_request.queue_id <> q.id or existing_request.customer_key <> p_customer_key then
      raise exception 'Join request unavailable' using errcode='QZ006';
    end if;
    select * into chosen_ticket from public.tickets where id=existing_request.ticket_id;
    return chosen_ticket.public_token;
  end if;

  -- A second form/tab for the same browser resumes its active ticket. Record
  -- this alias too, so a retry after completion cannot create another ticket.
  select * into chosen_ticket from public.tickets
    where queue_id=q.id and customer_key=p_customer_key and status in ('waiting','serving');
  if found then
    insert into public.queue_join_requests(id,queue_id,customer_key,ticket_id)
      values(p_request_id,q.id,p_customer_key,chosen_ticket.id);
    return chosen_ticket.public_token;
  end if;

  select timezone,is_active into location_timezone,location_active from public.locations
    where id=q.location_id and business_id=q.business_id for share;
  if not found or not location_active then raise exception 'Queue unavailable' using errcode='QZ001'; end if;
  if q.status <> 'open' then raise exception 'Queue is not open' using errcode='QZ002'; end if;
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 80
    or p_customer_name ~ '[[:cntrl:]]'
  then raise exception 'Invalid first name' using errcode='22023'; end if;
  normalized_phone := null;
  if q.allow_phone then
    if char_length(p_phone) > 32 then raise exception 'Invalid phone number' using errcode='QZ003'; end if;
    normalized_phone := nullif(regexp_replace(coalesce(p_phone,''),'[[:space:]()-]','','g'),'');
    if (q.require_phone and normalized_phone is null)
      or (normalized_phone is not null and normalized_phone !~ '^\+[1-9][0-9]{6,14}$')
    then raise exception 'Invalid phone number' using errcode='QZ003'; end if;
  end if;

  select count(*) filter(where status='waiting'), count(*) into waiting_total,active_total
    from public.tickets where queue_id=q.id and status in ('waiting','serving');
  -- A conservative Week-1 safety ceiling; no implicit unbounded ticket backlog.
  if active_total >= 1000 then raise exception 'Queue is at capacity' using errcode='QZ004'; end if;

  -- Evaluate date/time AFTER waiting for locks, including across local midnight.
  joined_time := clock_timestamp();
  insert into public.queue_join_rate_limits(key,window_started_at,joins)
    values(p_rate_key,joined_time,1)
    on conflict(key) do update set
      window_started_at=case when queue_join_rate_limits.window_started_at <= joined_time-interval '10 minutes' then joined_time else queue_join_rate_limits.window_started_at end,
      joins=case when queue_join_rate_limits.window_started_at <= joined_time-interval '10 minutes' then 1 else queue_join_rate_limits.joins+1 end
    returning joins into rate_joins;
  if rate_joins > 60 then raise exception 'Too many joins; try later' using errcode='QZ005'; end if;
  -- Raising rolls back the 61st increment as well as any subsequent writes.
  joined_time := clock_timestamp();
  local_date := (joined_time at time zone location_timezone)::date;

  insert into public.queue_daily_counters(queue_id,service_date,last_number)
    values(q.id,local_date,1)
    on conflict(queue_id,service_date) do update set last_number=queue_daily_counters.last_number+1
    returning last_number into next_number;
  insert into public.tickets(queue_id,service_date,sequence_number,display_number,customer_name,phone,
      customer_key,joined_at,estimated_wait_seconds)
    values(q.id,local_date,next_number,'A'||lpad(next_number::text,greatest(3,char_length(next_number::text)),'0'),
      btrim(p_customer_name),normalized_phone,p_customer_key,joined_time,(waiting_total*private.queue_service_seconds(q.id))::integer)
    returning * into chosen_ticket;
  insert into public.ticket_events(ticket_id,queue_id,type,actor_type,metadata,created_at)
    values(chosen_ticket.id,q.id,'joined','customer','{}'::jsonb,joined_time);
  insert into public.queue_join_requests(id,queue_id,customer_key,ticket_id,created_at)
    values(p_request_id,q.id,p_customer_key,chosen_ticket.id,joined_time);
  return chosen_ticket.public_token;
end;
$$;

commit;
