-- Additive: server-side event replay helpers (read-only)
-- Reconstructs current state from append-only event logs.

create or replace function public.replay_ticket_events(p_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  events jsonb;
  state jsonb := '{"status": null}'::jsonb;
  ev record;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'type', type, 'actor_type', actor_type, 'actor_id', actor_id,
    'metadata', metadata, 'created_at', created_at
  ) order by created_at), '[]'::jsonb)
  into events
  from public.ticket_events
  where ticket_id = p_ticket_id;

  for ev in
    select type, created_at from public.ticket_events
    where ticket_id = p_ticket_id order by created_at
  loop
    state := state || jsonb_build_object(
      'status', case ev.type::text
        when 'joined' then 'waiting'
        when 'called' then 'called'
        when 'recalled' then 'called'
        when 'completed' then 'completed'
        when 'no_show' then 'no_show'
        when 'cancelled' then 'cancelled'
        else state->>'status'
      end,
      'last_event', ev.type,
      'last_event_at', ev.created_at
    );
  end loop;

  return jsonb_build_object('events', events, 'state', state);
end;
$$;

create or replace function public.replay_booking_events(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  events jsonb;
  state jsonb := '{"status": null}'::jsonb;
  ev record;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'event_type', event_type, 'actor_type', actor_type, 'actor_id', actor_id,
    'payload', payload, 'created_at', created_at
  ) order by created_at), '[]'::jsonb)
  into events
  from public.booking_events
  where booking_id = p_booking_id;

  for ev in
    select event_type, created_at from public.booking_events
    where booking_id = p_booking_id order by created_at
  loop
    state := state || jsonb_build_object(
      'status', case ev.event_type
        when 'created' then 'CONFIRMED'
        when 'confirmed' then 'CONFIRMED'
        when 'checked_in' then 'CHECKED_IN'
        when 'ticket_assigned' then 'WAITING'
        when 'rescheduled' then 'CONFIRMED'
        when 'cancelled' then 'CANCELLED'
        when 'no_show' then 'NO_SHOW'
        when 'completed' then 'COMPLETED'
        else state->>'status'
      end,
      'last_event', ev.event_type,
      'last_event_at', ev.created_at
    );
  end loop;

  return jsonb_build_object('events', events, 'state', state);
end;
$$;

revoke all on function public.replay_ticket_events(uuid) from public, anon;
grant execute on function public.replay_ticket_events(uuid) to authenticated, service_role;

revoke all on function public.replay_booking_events(uuid) from public, anon;
grant execute on function public.replay_booking_events(uuid) to authenticated, service_role;
