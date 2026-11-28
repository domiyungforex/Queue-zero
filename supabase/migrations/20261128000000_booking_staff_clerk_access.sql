-- Fix: staff booking views always returned empty / zero.
--
-- Root cause: migration 20261112000000 compared the TEXT column
-- business_members.clerk_user_id against auth.uid(). Clerk subjects are
-- TEXT ("user_..."), so auth.uid()'s UUID cast cannot match them -- see
-- 20261001000001_tenant_rls.sql: "Clerk subjects are TEXT (user_...), so
-- auth.uid()'s UUID cast is inappropriate." With a Clerk JWT the RPC
-- membership check never succeeded (access denied / cast error), and
-- lib/booking/staff-actions.ts swallowed the error and rendered
-- "No bookings found" with all-zero metrics, so confirmed public bookings
-- were invisible to staff.
--
-- This migration redefines the two staff RPCs and the four booking RLS
-- policies to use private.current_clerk_user_id(), the Clerk-aware helper
-- used by the rest of the schema. Function bodies are otherwise unchanged
-- from 20261112000000.

begin;

-- RPC: Staff Query Bookings (membership check fixed)
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
  -- Validate staff caller has access to business (Clerk subject is TEXT)
  if not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.clerk_user_id = (select private.current_clerk_user_id())
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

-- RPC: Staff Booking Metrics (membership check fixed)
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
    where bm.business_id = p_business_id and bm.clerk_user_id = (select private.current_clerk_user_id())
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

revoke all on function public.get_staff_bookings(uuid, date, uuid, text, text, int, int) from public, anon, authenticated, service_role;
grant execute on function public.get_staff_bookings(uuid, date, uuid, text, text, int, int) to authenticated, service_role;

revoke all on function public.get_booking_metrics(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.get_booking_metrics(uuid, date) to authenticated, service_role;

-- RLS policies from 20261112000000 with the same broken comparison.
-- They made direct authenticated reads/writes of bookings,
-- booking_settings and booking_events fail or match nothing
-- (e.g. staffMarkNoShow's direct update, fetchBookingSettings' reads).
drop policy if exists "booking_settings_staff_read" on public.booking_settings;
create policy "booking_settings_staff_read" on public.booking_settings
  for select to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = booking_settings.organization_id
        and bm.clerk_user_id = (select private.current_clerk_user_id())
    )
  );

drop policy if exists "booking_settings_staff_modify" on public.booking_settings;
create policy "booking_settings_staff_modify" on public.booking_settings
  for all to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = booking_settings.organization_id
        and bm.clerk_user_id = (select private.current_clerk_user_id())
        and bm.role in ('owner', 'admin')
    )
  );

drop policy if exists "bookings_staff_all" on public.bookings;
create policy "bookings_staff_all" on public.bookings
  for all to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = bookings.organization_id
        and bm.clerk_user_id = (select private.current_clerk_user_id())
    )
  );

drop policy if exists "booking_events_staff_select" on public.booking_events;
create policy "booking_events_staff_select" on public.booking_events
  for select to authenticated using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = booking_events.organization_id
        and bm.clerk_user_id = (select private.current_clerk_user_id())
    )
  );

commit;
