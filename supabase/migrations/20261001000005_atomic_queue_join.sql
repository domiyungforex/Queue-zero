begin;

-- Opaque HMAC of a random browser cookie, not an account or a phone fingerprint.
alter table public.tickets add column customer_key text check (customer_key ~ '^[a-f0-9]{64}$');
create unique index tickets_one_active_per_customer on public.tickets(queue_id, customer_key)
  where customer_key is not null and status in ('waiting','serving');

create table public.queue_join_requests (
  id uuid primary key,
  queue_id uuid not null references public.queues(id) on delete restrict,
  customer_key text not null check (customer_key ~ '^[a-f0-9]{64}$'),
  ticket_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(ticket_id,queue_id) references public.tickets(id,queue_id) on delete restrict
);
create index queue_join_requests_ticket on public.queue_join_requests(ticket_id,queue_id);
alter table public.queue_join_requests enable row level security;
alter table public.queue_join_requests force row level security;
revoke all on public.queue_join_requests from public, anon, authenticated, service_role;
grant select, insert on public.queue_join_requests to service_role;

create table public.queue_join_rate_limits (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  joins integer not null check (joins between 1 and 61)
);
alter table public.queue_join_rate_limits enable row level security;
alter table public.queue_join_rate_limits force row level security;
revoke all on public.queue_join_rate_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.queue_join_rate_limits to service_role;

create function public.get_public_join_options(p_slug text)
returns table(slug text, business_name text, queue_name text, status public.queue_status, allow_phone boolean, require_phone boolean)
language sql stable security definer set search_path = '' as $$
  select q.slug,b.name,q.name,q.status,q.allow_phone,q.require_phone
  from public.queues q join public.businesses b on b.id=q.business_id
  join public.locations l on l.id=q.location_id and l.business_id=q.business_id and l.is_active
  where char_length(p_slug) between 3 and 100 and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and q.slug=p_slug;
$$;
revoke all on function public.get_public_join_options(text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_join_options(text) to anon,authenticated;

-- Only the server can invoke this mutation. Rate/customer keys must come from
-- trusted request context, never form fields or a direct anonymous RPC call.
create function public.join_public_queue(
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
      btrim(p_customer_name),normalized_phone,p_customer_key,joined_time,(waiting_total*q.average_service_seconds)::integer)
    returning * into chosen_ticket;
  insert into public.ticket_events(ticket_id,queue_id,type,actor_type,metadata,created_at)
    values(chosen_ticket.id,q.id,'joined','customer','{}'::jsonb,joined_time);
  insert into public.queue_join_requests(id,queue_id,customer_key,ticket_id,created_at)
    values(p_request_id,q.id,p_customer_key,chosen_ticket.id,joined_time);
  return chosen_ticket.public_token;
end;
$$;
revoke all on function public.join_public_queue(text,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.join_public_queue(text,uuid,text,text,text,text) to service_role;

-- Minimal receipt for the join redirect. Full ticket tracking is a separate task.
create function public.get_public_ticket_receipt(p_token uuid)
returns table(display_number text,business_name text,queue_name text,status public.ticket_status)
language sql stable security definer set search_path = '' as $$
  select t.display_number,b.name,q.name,t.status from public.tickets t
    join public.queues q on q.id=t.queue_id join public.businesses b on b.id=q.business_id
    where t.public_token=p_token;
$$;
revoke all on function public.get_public_ticket_receipt(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_ticket_receipt(uuid) to anon,authenticated;

commit;
