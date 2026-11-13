-- Migration: Booking + Virtual Queue Integration
-- Provides capacity-controlled advance bookings, atomic check-in into live queues,
-- configurable operating hours, slot capacities, and staff management.

-- 1. Booking Settings
create table if not exists public.booking_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  queue_id uuid references public.queues(id) on delete cascade,
  enabled boolean not null default true,
  booking_type text not null default 'SCHEDULED_ARRIVAL' check (booking_type in ('SCHEDULED_ARRIVAL','SERVICE_APPOINTMENT','FUTURE_QUEUE_RESERVATION')),
  operating_days integer[] not null default array[1,2,3,4,5], -- 1=Monday, 7=Sunday
  opening_time time not null default '08:00:00',
  closing_time time not null default '17:00:00',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes in (10,15,20,30,45,60)),
  max_capacity_per_slot integer not null default 8 check (max_capacity_per_slot > 0),
  min_advance_minutes integer not null default 30 check (min_advance_minutes >= 0),
  max_advance_days integer not null default 14 check (max_advance_days >= 1),
  arrival_grace_minutes integer not null default 15 check (arrival_grace_minutes >= 0),
  allocation_mode text not null default 'BOOKING_AND_WALK_IN' check (allocation_mode in ('BOOKING_AND_WALK_IN','BOOKING_ONLY','WALK_IN_ONLY')),
  walkin_reserved_capacity integer not null default 4 check (walkin_reserved_capacity >= 0),
  booking_priority_policy text not null default 'ARRIVAL_ORDER' check (booking_priority_policy in ('ARRIVAL_ORDER','SCHEDULED_WINDOW_PRIORITY','RESERVED_CAPACITY')),
  cancellation_allowed boolean not null default true,
  rescheduling_allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists booking_settings_org_queue_idx
  on public.booking_settings(organization_id, coalesce(queue_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. Bookings Table
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  queue_id uuid not null references public.queues(id) on delete cascade,
  service_id uuid references public.institution_services(id) on delete set null,
  customer_name text not null check (length(customer_name) between 1 and 160),
  customer_phone text not null check (length(customer_phone) between 3 and 32),
  customer_email text check (customer_email is null or length(customer_email) <= 255),
  booking_reference text not null unique,
  management_token uuid not null unique default gen_random_uuid(),
  booking_type text not null default 'SCHEDULED_ARRIVAL' check (booking_type in ('SCHEDULED_ARRIVAL','SERVICE_APPOINTMENT','FUTURE_QUEUE_RESERVATION')),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Africa/Lagos',
  status text not null default 'CONFIRMED' check (status in ('PENDING','CONFIRMED','CHECKED_IN','WAITING','CALLED','IN_SERVICE','COMPLETED','CANCELLED','RESCHEDULED','EXPIRED','NO_SHOW')),
  checked_in_at timestamptz,
  queue_ticket_id uuid references public.tickets(id) on delete set null,
  cancellation_reason text check (cancellation_reason is null or length(cancellation_reason) <= 500),
  cancelled_at timestamptz,
  no_show_at timestamptz,
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_org_date_idx on public.bookings(organization_id, booking_date);
create index if not exists bookings_queue_date_slot_idx on public.bookings(queue_id, booking_date, start_time);
create index if not exists bookings_reference_idx on public.bookings(booking_reference);
create index if not exists bookings_token_idx on public.bookings(management_token);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_ticket_idx on public.bookings(queue_ticket_id);

-- 3. Booking Events Table (Audit History)
create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null check (event_type in ('created','confirmed','checked_in','ticket_assigned','rescheduled','cancelled','no_show','completed','updated')),
  actor_type text not null check (actor_type in ('customer','staff','system')),
  actor_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_events_booking_id_idx on public.booking_events(booking_id);

-- 4. Enable Row Level Security
alter table public.booking_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;

-- RLS: Booking Settings
create policy "booking_settings_staff_read" on public.booking_settings
  for select to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = booking_settings.organization_id
        and bm.clerk_user_id = auth.uid()
    )
  );

create policy "booking_settings_staff_modify" on public.booking_settings
  for all to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = booking_settings.organization_id
        and bm.clerk_user_id = auth.uid()
        and bm.role in ('owner', 'admin')
    )
  );

create policy "booking_settings_public_read" on public.booking_settings
  for select to anon using (enabled = true);

-- RLS: Bookings
create policy "bookings_staff_all" on public.bookings
  for all to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = bookings.organization_id
        and bm.clerk_user_id = auth.uid()
    )
  );

-- RLS: Booking Events
create policy "booking_events_staff_select" on public.booking_events
  for select to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = booking_events.organization_id
        and bm.clerk_user_id = auth.uid()
    )
  );

-- 5. Stored Procedures and RPCs

-- Helper: Get or create default booking settings for a queue
create or replace function private.get_effective_booking_settings(p_queue_id uuid)
returns public.booking_settings language plpgsql stable security definer set search_path = '' as $$
declare
  v_queue public.queues%rowtype;
  v_settings public.booking_settings%rowtype;
begin
  select * into v_queue from public.queues where id = p_queue_id;
  if not found then return null; end if;

  -- 1. Check queue-specific override
  select * into v_settings from public.booking_settings
  where queue_id = p_queue_id and organization_id = v_queue.business_id;
  if found then return v_settings; end if;

  -- 2. Check organization-level default
  select * into v_settings from public.booking_settings
  where organization_id = v_queue.business_id and queue_id is null;
  if found then return v_settings; end if;

  -- 3. Sensible fallback record constructed on the fly
  v_settings.organization_id := v_queue.business_id;
  v_settings.queue_id := p_queue_id;
  v_settings.enabled := true;
  v_settings.booking_type := 'SCHEDULED_ARRIVAL';
  v_settings.operating_days := array[1,2,3,4,5];
  v_settings.opening_time := coalesce(v_queue.opens_at::time, '08:00:00'::time);
  v_settings.closing_time := coalesce(v_queue.closes_at::time, '17:00:00'::time);
  v_settings.slot_interval_minutes := 30;
  v_settings.max_capacity_per_slot := 8;
  v_settings.min_advance_minutes := 30;
  v_settings.max_advance_days := 14;
  v_settings.arrival_grace_minutes := 15;
  v_settings.allocation_mode := 'BOOKING_AND_WALK_IN';
  v_settings.walkin_reserved_capacity := 4;
  v_settings.booking_priority_policy := 'ARRIVAL_ORDER';
  v_settings.cancellation_allowed := true;
  v_settings.rescheduling_allowed := true;
  return v_settings;
end;
$$;

-- RPC: Get Public Booking Info (Details of organization, location, queue, and settings)
create or replace function public.get_public_booking_info(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_queue public.queues%rowtype;
  v_business public.businesses%rowtype;
  v_location public.locations%rowtype;
  v_settings public.booking_settings%rowtype;
begin
  select * into v_queue from public.queues where slug = p_slug;
  if not found then return null; end if;

  select * into v_business from public.businesses where id = v_queue.business_id;
  select * into v_location from public.locations where id = v_queue.location_id;
  v_settings := private.get_effective_booking_settings(v_queue.id);

  return jsonb_build_object(
    'queue_id', v_queue.id,
    'queue_name', v_queue.name,
    'service_name', v_queue.service_name,
    'queue_slug', v_queue.slug,
    'description', v_queue.description,
    'organization_id', v_business.id,
    'business_name', v_business.name,
    'business_logo_url', v_business.logo_url,
    'location_id', v_location.id,
    'location_name', v_location.name,
    'location_address', v_location.address,
    'timezone', coalesce(v_location.timezone, v_business.timezone, 'Africa/Lagos'),
    'booking_enabled', coalesce(v_settings.enabled, true),
    'booking_type', coalesce(v_settings.booking_type, 'SCHEDULED_ARRIVAL'),
    'operating_days', coalesce(v_settings.operating_days, array[1,2,3,4,5]),
    'opening_time', coalesce(v_settings.opening_time::text, '08:00:00'),
    'closing_time', coalesce(v_settings.closing_time::text, '17:00:00'),
    'slot_interval_minutes', coalesce(v_settings.slot_interval_minutes, 30),
    'max_capacity_per_slot', coalesce(v_settings.max_capacity_per_slot, 8),
    'min_advance_minutes', coalesce(v_settings.min_advance_minutes, 30),
    'max_advance_days', coalesce(v_settings.max_advance_days, 14),
    'arrival_grace_minutes', coalesce(v_settings.arrival_grace_minutes, 15),
    'allocation_mode', coalesce(v_settings.allocation_mode, 'BOOKING_AND_WALK_IN'),
    'cancellation_allowed', coalesce(v_settings.cancellation_allowed, true),
    'rescheduling_allowed', coalesce(v_settings.rescheduling_allowed, true)
  );
end;
$$;

-- RPC: Get Availability for a Specific Date
create or replace function public.get_booking_availability(p_slug text, p_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_queue public.queues%rowtype;
  v_location public.locations%rowtype;
  v_settings public.booking_settings%rowtype;
  v_tz text;
  v_dow integer;
  v_now timestamptz := clock_timestamp();
  v_today_in_tz date;
  v_slot_start time;
  v_slot_end time;
  v_slot_starts_at timestamptz;
  v_interval interval;
  v_booked_count bigint;
  v_available_cap integer;
  v_is_available boolean;
  v_slots jsonb := '[]'::jsonb;
begin
  select * into v_queue from public.queues where slug = p_slug;
  if not found then return '[]'::jsonb; end if;

  select * into v_location from public.locations where id = v_queue.location_id;
  v_tz := coalesce(v_location.timezone, 'Africa/Lagos');
  v_settings := private.get_effective_booking_settings(v_queue.id);

  if not coalesce(v_settings.enabled, true) then return '[]'::jsonb; end if;

  -- Validate date is within advance horizon
  v_today_in_tz := (v_now at time zone v_tz)::date;
  if p_date < v_today_in_tz or p_date > (v_today_in_tz + (v_settings.max_advance_days || ' days')::interval)::date then
    return '[]'::jsonb;
  end if;

  -- Validate day of week (PostgreSQL extract(isodow): 1=Mon, 7=Sun)
  v_dow := extract(isodow from p_date)::integer;
  if not (v_dow = any(v_settings.operating_days)) then
    return '[]'::jsonb;
  end if;

  v_interval := (v_settings.slot_interval_minutes || ' minutes')::interval;
  v_slot_start := v_settings.opening_time;

  while v_slot_start + v_interval <= v_settings.closing_time loop
    v_slot_end := (v_slot_start + v_interval)::time;
    v_slot_starts_at := (p_date::text || ' ' || v_slot_start::text)::timestamp at time zone v_tz;

    -- Count existing confirmed / checked in bookings for this slot
    select count(*) into v_booked_count
    from public.bookings
    where queue_id = v_queue.id
      and booking_date = p_date
      and start_time = v_slot_start
      and status in ('CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED');

    v_available_cap := greatest(0, v_settings.max_capacity_per_slot - v_booked_count::integer);
    
    -- Check lead time requirement
    v_is_available := (v_available_cap > 0) and (v_slot_starts_at > v_now + (v_settings.min_advance_minutes || ' minutes')::interval);

    v_slots := v_slots || jsonb_build_object(
      'start_time', to_char(v_slot_start, 'HH24:MI'),
      'end_time', to_char(v_slot_end, 'HH24:MI'),
      'total_capacity', v_settings.max_capacity_per_slot,
      'booked_count', v_booked_count,
      'available_capacity', v_available_cap,
      'is_available', v_is_available
    );

    v_slot_start := (v_slot_start + v_interval)::time;
  end loop;

  return v_slots;
end;
$$;

-- RPC: Atomic Public Booking
create or replace function public.book_time_atomic(
  p_slug text,
  p_date date,
  p_start_time time,
  p_customer_name text,
  p_phone text,
  p_email text default null,
  p_request_id uuid default gen_random_uuid()
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_queue public.queues%rowtype;
  v_location public.locations%rowtype;
  v_business public.businesses%rowtype;
  v_settings public.booking_settings%rowtype;
  v_tz text;
  v_dow integer;
  v_now timestamptz := clock_timestamp();
  v_today_in_tz date;
  v_slot_end time;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_current_count bigint;
  v_ref text;
  v_booking public.bookings%rowtype;
begin
  if p_slug is null or p_date is null or p_start_time is null or p_customer_name is null or p_phone is null then
    raise exception 'Missing required booking fields' using errcode = '22023';
  end if;

  select * into v_queue from public.queues where slug = p_slug;
  if not found then raise exception 'Queue unavailable' using errcode = 'QZ001'; end if;

  select * into v_business from public.businesses where id = v_queue.business_id;
  select * into v_location from public.locations where id = v_queue.location_id;
  v_tz := coalesce(v_location.timezone, v_business.timezone, 'Africa/Lagos');
  v_settings := private.get_effective_booking_settings(v_queue.id);

  if not coalesce(v_settings.enabled, true) then
    raise exception 'Booking is not enabled for this service' using errcode = 'QZ002';
  end if;

  v_today_in_tz := (v_now at time zone v_tz)::date;
  if p_date < v_today_in_tz then
    raise exception 'Cannot book for a past date' using errcode = '22023';
  end if;

  if p_date > (v_today_in_tz + (v_settings.max_advance_days || ' days')::interval)::date then
    raise exception 'Booking date is beyond the allowed advance window' using errcode = '22023';
  end if;

  v_dow := extract(isodow from p_date)::integer;
  if not (v_dow = any(v_settings.operating_days)) then
    raise exception 'This service is not available on the selected day' using errcode = '22023';
  end if;

  v_slot_end := (p_start_time + (v_settings.slot_interval_minutes || ' minutes')::interval)::time;
  v_starts_at := (p_date::text || ' ' || p_start_time::text)::timestamp at time zone v_tz;
  v_ends_at := (p_date::text || ' ' || v_slot_end::text)::timestamp at time zone v_tz;

  if v_starts_at < v_now + (v_settings.min_advance_minutes || ' minutes')::interval then
    raise exception 'Selected time window is no longer available. Please select a later time.' using errcode = 'QZ008';
  end if;

  -- Transactional Slot Lock: Prevents race conditions for the final slot
  perform pg_advisory_xact_lock(hashtextextended(v_queue.id::text || ':' || p_date::text || ':' || p_start_time::text, 10));

  select count(*) into v_current_count
  from public.bookings
  where queue_id = v_queue.id
    and booking_date = p_date
    and start_time = p_start_time
    and status in ('CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED');

  if v_current_count >= v_settings.max_capacity_per_slot then
    raise exception 'This time window is fully booked. Please select another time.' using errcode = 'QZ010';
  end if;

  -- Generate human-friendly reference e.g. TM-7K3B9A
  v_ref := 'TM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.bookings (
    organization_id, location_id, queue_id,
    customer_name, customer_phone, customer_email,
    booking_reference, management_token, booking_type,
    booking_date, start_time, end_time, starts_at, ends_at, timezone,
    status
  ) values (
    v_business.id, v_location.id, v_queue.id,
    btrim(p_customer_name), btrim(p_phone), nullif(btrim(coalesce(p_email, '')), ''),
    v_ref, gen_random_uuid(), v_settings.booking_type,
    p_date, p_start_time, v_slot_end, v_starts_at, v_ends_at, v_tz,
    'CONFIRMED'
  ) returning * into v_booking;

  insert into public.booking_events (
    organization_id, booking_id, event_type, actor_type, actor_id, payload
  ) values (
    v_business.id, v_booking.id, 'confirmed', 'customer', null,
    jsonb_build_object('reference', v_ref, 'date', p_date, 'time', p_start_time)
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_booking.id,
    'booking_reference', v_booking.booking_reference,
    'management_token', v_booking.management_token,
    'booking_date', v_booking.booking_date,
    'start_time', to_char(v_booking.start_time, 'HH24:MI'),
    'end_time', to_char(v_booking.end_time, 'HH24:MI'),
    'customer_name', v_booking.customer_name,
    'service_name', v_queue.service_name,
    'queue_name', v_queue.name,
    'business_name', v_business.name,
    'location_name', v_location.name,
    'status', v_booking.status,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'arrival_grace_minutes', v_settings.arrival_grace_minutes
  );
end;
$$;

-- RPC: Retrieve Public Booking by Management Token
create or replace function public.get_public_booking(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_queue public.queues%rowtype;
  v_business public.businesses%rowtype;
  v_location public.locations%rowtype;
  v_ticket public.tickets%rowtype;
  v_settings public.booking_settings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_can_check_in boolean := false;
  v_early_window interval;
  v_late_window interval;
  v_people_ahead bigint := null;
begin
  select * into v_booking from public.bookings where management_token = p_token;
  if not found then return null; end if;

  select * into v_queue from public.queues where id = v_booking.queue_id;
  select * into v_business from public.businesses where id = v_booking.organization_id;
  select * into v_location from public.locations where id = v_booking.location_id;
  v_settings := private.get_effective_booking_settings(v_queue.id);

  -- Check-in is eligible from 20 minutes before window starts until grace period ends after slot ends
  v_early_window := interval '20 minutes';
  v_late_window := (v_settings.arrival_grace_minutes || ' minutes')::interval;

  if v_booking.status = 'CONFIRMED' then
    if v_now >= (v_booking.starts_at - v_early_window) and v_now <= (v_booking.ends_at + v_late_window) then
      v_can_check_in := true;
    end if;
  end if;

  if v_booking.queue_ticket_id is not null then
    select * into v_ticket from public.tickets where id = v_booking.queue_ticket_id;
    if found and v_ticket.status = 'waiting' then
      select count(*) into v_people_ahead from public.tickets
      where queue_id = v_ticket.queue_id
        and status = 'waiting'
        and sequence_number < v_ticket.sequence_number;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_booking.id,
    'booking_reference', v_booking.booking_reference,
    'management_token', v_booking.management_token,
    'customer_name', v_booking.customer_name,
    'customer_phone', v_booking.customer_phone,
    'customer_email', v_booking.customer_email,
    'booking_type', v_booking.booking_type,
    'booking_date', v_booking.booking_date,
    'start_time', to_char(v_booking.start_time, 'HH24:MI'),
    'end_time', to_char(v_booking.end_time, 'HH24:MI'),
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'timezone', v_booking.timezone,
    'status', v_booking.status,
    'checked_in_at', v_booking.checked_in_at,
    'can_check_in', v_can_check_in,
    'arrival_grace_minutes', v_settings.arrival_grace_minutes,
    'queue_id', v_queue.id,
    'queue_name', v_queue.name,
    'service_name', v_queue.service_name,
    'queue_slug', v_queue.slug,
    'business_name', v_business.name,
    'location_name', v_location.name,
    'location_address', v_location.address,
    'ticket', case when v_ticket.id is not null then jsonb_build_object(
      'id', v_ticket.id,
      'display_number', v_ticket.display_number,
      'status', v_ticket.status,
      'public_token', v_ticket.public_token,
      'people_ahead', v_people_ahead,
      'estimated_wait_seconds', v_ticket.estimated_wait_seconds
    ) else null end
  );
end;
$$;

-- RPC: Atomic Check-in into Queue
create or replace function public.check_in_booking_atomic(
  p_token uuid,
  p_actor_type text default 'customer',
  p_actor_id text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_queue public.queues%rowtype;
  v_location public.locations%rowtype;
  v_settings public.booking_settings%rowtype;
  v_ticket public.tickets%rowtype;
  v_now timestamptz := clock_timestamp();
  v_local_date date;
  v_next_num integer;
  v_waiting_total bigint;
  v_people_ahead bigint;
  v_display_prefix text := 'A';
begin
  -- Lock booking row
  select * into v_booking from public.bookings where management_token = p_token or id = p_token for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'QZ001';
  end if;

  -- If already checked in, return the existing ticket idempotently
  if v_booking.status = 'CHECKED_IN' and v_booking.queue_ticket_id is not null then
    select * into v_ticket from public.tickets where id = v_booking.queue_ticket_id;
    if found then
      select count(*) into v_people_ahead from public.tickets
      where queue_id = v_ticket.queue_id and status = 'waiting' and sequence_number < v_ticket.sequence_number;
      return jsonb_build_object(
        'ok', true,
        'already_checked_in', true,
        'ticket_id', v_ticket.id,
        'display_number', v_ticket.display_number,
        'public_token', v_ticket.public_token,
        'status', v_ticket.status,
        'people_ahead', v_people_ahead,
        'estimated_wait_seconds', v_ticket.estimated_wait_seconds
      );
    end if;
  end if;

  if v_booking.status <> 'CONFIRMED' then
    raise exception 'This booking cannot be checked in (status: %)', v_booking.status using errcode = '22023';
  end if;

  select * into v_queue from public.queues where id = v_booking.queue_id for update;
  select * into v_location from public.locations where id = v_booking.location_id;
  v_settings := private.get_effective_booking_settings(v_queue.id);

  -- For customer self check-in, verify arrival window and grace period
  if p_actor_type = 'customer' then
    if v_now < (v_booking.starts_at - interval '20 minutes') then
      raise exception 'Too early to check in. Please check in when your arrival window starts.' using errcode = 'QZ011';
    end if;
    if v_now > (v_booking.ends_at + (v_settings.arrival_grace_minutes || ' minutes')::interval) then
      raise exception 'Arrival grace period has expired. Please speak with staff at the counter.' using errcode = 'QZ012';
    end if;
  end if;

  v_local_date := (v_now at time zone coalesce(v_location.timezone, 'Africa/Lagos'))::date;

  -- Queue sequence counter
  insert into public.queue_daily_counters(queue_id, service_date, last_number)
  values (v_queue.id, v_local_date, 1)
  on conflict (queue_id, service_date) do update set last_number = queue_daily_counters.last_number + 1
  returning last_number into v_next_num;

  -- Check priority policy
  if v_settings.booking_priority_policy = 'SCHEDULED_WINDOW_PRIORITY' then
    v_display_prefix := 'B';
  end if;

  select count(*) into v_waiting_total from public.tickets
  where queue_id = v_queue.id and status = 'waiting';

  -- Create Queue Ticket
  insert into public.tickets (
    queue_id, service_date, sequence_number, display_number,
    customer_name, phone, customer_key, joined_at,
    estimated_wait_seconds, status
  ) values (
    v_queue.id, v_local_date, v_next_num,
    v_display_prefix || lpad(v_next_num::text, greatest(3, length(v_next_num::text)), '0'),
    v_booking.customer_name, v_booking.customer_phone,
    md5(v_booking.id::text || ':' || v_booking.customer_phone), v_now,
    (v_waiting_total * coalesce(v_queue.average_service_seconds, 300))::integer,
    'waiting'
  ) returning * into v_ticket;

  insert into public.ticket_events (ticket_id, queue_id, type, actor_type, metadata, created_at)
  values (v_ticket.id, v_queue.id, 'joined', p_actor_type, jsonb_build_object('booking_id', v_booking.id, 'reference', v_booking.booking_reference), v_now);

  -- Update Booking status
  update public.bookings set
    status = 'CHECKED_IN',
    checked_in_at = v_now,
    queue_ticket_id = v_ticket.id,
    updated_at = v_now
  where id = v_booking.id;

  insert into public.booking_events (
    organization_id, booking_id, event_type, actor_type, actor_id, payload
  ) values (
    v_booking.organization_id, v_booking.id, 'checked_in', p_actor_type, p_actor_id,
    jsonb_build_object('ticket_id', v_ticket.id, 'display_number', v_ticket.display_number, 'public_token', v_ticket.public_token)
  );

  return jsonb_build_object(
    'ok', true,
    'already_checked_in', false,
    'ticket_id', v_ticket.id,
    'display_number', v_ticket.display_number,
    'public_token', v_ticket.public_token,
    'status', v_ticket.status,
    'people_ahead', v_waiting_total,
    'estimated_wait_seconds', v_ticket.estimated_wait_seconds
  );
end;
$$;

-- RPC: Atomic Cancellation
create or replace function public.cancel_booking_atomic(
  p_token uuid,
  p_reason text default null,
  p_actor_type text default 'customer',
  p_actor_id text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_booking from public.bookings where (management_token = p_token or id = p_token) for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'QZ001';
  end if;

  if v_booking.status in ('CANCELLED', 'COMPLETED', 'NO_SHOW') then
    raise exception 'Booking cannot be cancelled in its current state (%)', v_booking.status using errcode = '22023';
  end if;

  update public.bookings set
    status = 'CANCELLED',
    cancellation_reason = p_reason,
    cancelled_at = v_now,
    updated_at = v_now
  where id = v_booking.id;

  -- If there was a live queue ticket, cancel it as well
  if v_booking.queue_ticket_id is not null then
    update public.tickets set
      status = 'cancelled',
      cancelled_at = v_now,
      updated_at = v_now
    where id = v_booking.queue_ticket_id and status in ('waiting', 'serving');

    insert into public.ticket_events (ticket_id, queue_id, type, actor_type, metadata, created_at)
    values (v_booking.queue_ticket_id, v_booking.queue_id, 'cancelled', p_actor_type, jsonb_build_object('reason', p_reason), v_now);
  end if;

  insert into public.booking_events (
    organization_id, booking_id, event_type, actor_type, actor_id, payload
  ) values (
    v_booking.organization_id, v_booking.id, 'cancelled', p_actor_type, p_actor_id,
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'status', 'CANCELLED');
end;
$$;

-- RPC: Atomic Rescheduling
create or replace function public.reschedule_booking_atomic(
  p_token uuid,
  p_new_date date,
  p_new_start_time time,
  p_actor_type text default 'customer',
  p_actor_id text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_queue public.queues%rowtype;
  v_location public.locations%rowtype;
  v_settings public.booking_settings%rowtype;
  v_tz text;
  v_dow integer;
  v_now timestamptz := clock_timestamp();
  v_today_in_tz date;
  v_slot_end time;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_current_count bigint;
begin
  select * into v_booking from public.bookings where (management_token = p_token or id = p_token) for update;
  if not found then raise exception 'Booking not found' using errcode = 'QZ001'; end if;

  if v_booking.status not in ('CONFIRMED') then
    raise exception 'Only confirmed bookings can be rescheduled' using errcode = '22023';
  end if;

  select * into v_queue from public.queues where id = v_booking.queue_id;
  select * into v_location from public.locations where id = v_booking.location_id;
  v_tz := v_booking.timezone;
  v_settings := private.get_effective_booking_settings(v_queue.id);

  if not v_settings.rescheduling_allowed and p_actor_type = 'customer' then
    raise exception 'Rescheduling is not permitted for this service' using errcode = 'QZ013';
  end if;

  v_today_in_tz := (v_now at time zone v_tz)::date;
  if p_new_date < v_today_in_tz or p_new_date > (v_today_in_tz + (v_settings.max_advance_days || ' days')::interval)::date then
    raise exception 'New booking date is outside the permitted window' using errcode = '22023';
  end if;

  v_dow := extract(isodow from p_new_date)::integer;
  if not (v_dow = any(v_settings.operating_days)) then
    raise exception 'Service is closed on the selected day' using errcode = '22023';
  end if;

  v_slot_end := (p_new_start_time + (v_settings.slot_interval_minutes || ' minutes')::interval)::time;
  v_starts_at := (p_new_date::text || ' ' || p_new_start_time::text)::timestamp at time zone v_tz;
  v_ends_at := (p_new_date::text || ' ' || v_slot_end::text)::timestamp at time zone v_tz;

  if v_starts_at < v_now + (v_settings.min_advance_minutes || ' minutes')::interval then
    raise exception 'Selected time is too close to now. Please pick a later time.' using errcode = 'QZ008';
  end if;

  -- Lock target slot
  perform pg_advisory_xact_lock(hashtextextended(v_queue.id::text || ':' || p_new_date::text || ':' || p_new_start_time::text, 10));

  select count(*) into v_current_count
  from public.bookings
  where queue_id = v_queue.id
    and booking_date = p_new_date
    and start_time = p_new_start_time
    and id <> v_booking.id
    and status in ('CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED');

  if v_current_count >= v_settings.max_capacity_per_slot then
    raise exception 'The new time window is fully booked.' using errcode = 'QZ010';
  end if;

  update public.bookings set
    booking_date = p_new_date,
    start_time = p_new_start_time,
    end_time = v_slot_end,
    starts_at = v_starts_at,
    ends_at = v_ends_at,
    updated_at = v_now
  where id = v_booking.id;

  insert into public.booking_events (
    organization_id, booking_id, event_type, actor_type, actor_id, payload
  ) values (
    v_booking.organization_id, v_booking.id, 'rescheduled', p_actor_type, p_actor_id,
    jsonb_build_object('old_date', v_booking.booking_date, 'old_time', v_booking.start_time, 'new_date', p_new_date, 'new_time', p_new_start_time)
  );

  return jsonb_build_object(
    'ok', true,
    'booking_date', p_new_date,
    'start_time', to_char(p_new_start_time, 'HH24:MI'),
    'end_time', to_char(v_slot_end, 'HH24:MI')
  );
end;
$$;

-- RPC: Staff Query Bookings
create or replace function public.get_staff_bookings(
  p_business_id uuid,
  p_date date default null,
  p_queue_id uuid default null,
  p_status text default null,
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_total bigint;
begin
  -- Validate staff caller has access to business
  if not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.clerk_user_id = auth.uid()
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.bookings b
  join public.queues q on q.id = b.queue_id
  where b.organization_id = p_business_id
    and (p_date is null or b.booking_date = p_date)
    and (p_queue_id is null or b.queue_id = p_queue_id)
    and (p_status is null or p_status = 'ALL' or b.status = p_status)
    and (
      p_search is null or p_search = ''
      or b.customer_name ilike '%' || p_search || '%'
      or b.customer_phone ilike '%' || p_search || '%'
      or b.booking_reference ilike '%' || p_search || '%'
    );

  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_result
  from (
    select
      b.id,
      b.booking_reference,
      b.management_token,
      b.customer_name,
      b.customer_phone,
      b.customer_email,
      b.booking_date,
      to_char(b.start_time, 'HH24:MI') as start_time,
      to_char(b.end_time, 'HH24:MI') as end_time,
      b.starts_at,
      b.ends_at,
      b.status,
      b.checked_in_at,
      b.cancellation_reason,
      b.notes,
      b.queue_id,
      q.name as queue_name,
      q.service_name,
      l.name as location_name,
      t.display_number as ticket_number,
      t.status as ticket_status,
      t.public_token as ticket_public_token
    from public.bookings b
    join public.queues q on q.id = b.queue_id
    join public.locations l on l.id = b.location_id
    left join public.tickets t on t.id = b.queue_ticket_id
    where b.organization_id = p_business_id
      and (p_date is null or b.booking_date = p_date)
      and (p_queue_id is null or b.queue_id = p_queue_id)
      and (p_status is null or p_status = 'ALL' or b.status = p_status)
      and (
        p_search is null or p_search = ''
        or b.customer_name ilike '%' || p_search || '%'
        or b.customer_phone ilike '%' || p_search || '%'
        or b.booking_reference ilike '%' || p_search || '%'
      )
    order by b.booking_date desc, b.start_time asc
    limit p_limit offset p_offset
  ) item;

  return jsonb_build_object('total', v_total, 'bookings', v_result);
end;
$$;

-- RPC: Staff Booking Metrics
create or replace function public.get_booking_metrics(
  p_business_id uuid,
  p_date date default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_date date := coalesce(p_date, current_date);
  v_total bigint;
  v_confirmed bigint;
  v_checked_in bigint;
  v_cancelled bigint;
  v_no_show bigint;
  v_completed bigint;
begin
  if not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.clerk_user_id = auth.uid()
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where status = 'CONFIRMED'),
    count(*) filter (where status in ('CHECKED_IN', 'WAITING', 'CALLED', 'IN_SERVICE')),
    count(*) filter (where status = 'CANCELLED'),
    count(*) filter (where status = 'NO_SHOW'),
    count(*) filter (where status = 'COMPLETED')
  into v_total, v_confirmed, v_checked_in, v_cancelled, v_no_show, v_completed
  from public.bookings
  where organization_id = p_business_id and booking_date = v_date;

  return jsonb_build_object(
    'date', v_date,
    'total', v_total,
    'confirmed', v_confirmed,
    'checked_in', v_checked_in,
    'cancelled', v_cancelled,
    'no_show', v_no_show,
    'completed', v_completed
  );
end;
$$;

-- Grant execution permissions
revoke all on function public.get_public_booking_info(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_booking_info(text) to anon, authenticated, service_role;

revoke all on function public.get_booking_availability(text, date) from public, anon, authenticated, service_role;
grant execute on function public.get_booking_availability(text, date) to anon, authenticated, service_role;

revoke all on function public.book_time_atomic(text, date, time, text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.book_time_atomic(text, date, time, text, text, text, uuid) to anon, authenticated, service_role;

revoke all on function public.get_public_booking(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_public_booking(uuid) to anon, authenticated, service_role;

revoke all on function public.check_in_booking_atomic(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.check_in_booking_atomic(uuid, text, text) to anon, authenticated, service_role;

revoke all on function public.cancel_booking_atomic(uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_booking_atomic(uuid, text, text, text) to anon, authenticated, service_role;

revoke all on function public.reschedule_booking_atomic(uuid, date, time, text, text) from public, anon, authenticated, service_role;
grant execute on function public.reschedule_booking_atomic(uuid, date, time, text, text) to anon, authenticated, service_role;

revoke all on function public.get_staff_bookings(uuid, date, uuid, text, text, int, int) from public, anon, authenticated, service_role;
grant execute on function public.get_staff_bookings(uuid, date, uuid, text, text, int, int) to authenticated, service_role;

revoke all on function public.get_booking_metrics(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.get_booking_metrics(uuid, date) to authenticated, service_role;
