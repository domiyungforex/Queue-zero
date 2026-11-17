-- Additive: wire operations_events as a unified timeline via triggers.
-- Existing event tables remain the domain projections.
-- Triggers write to operations_events in the same transaction (transactional outbox style).

-- Ticket events → operations_events
create or replace function private.sync_ticket_to_operations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select business_id into v_org from public.queues where id = new.queue_id;
  if v_org is null then return new; end if;
  insert into public.operations_events (organization_id, subject_type, subject_id, event_type, actor_type, actor_id, metadata)
  values (v_org, 'TICKET', new.ticket_id, new.type::text, new.actor_type::text, new.actor_id, new.metadata);
  return new;
end;
$$;
revoke all on function private.sync_ticket_to_operations() from public, anon, authenticated, service_role;

drop trigger if exists ticket_events_to_operations on public.ticket_events;
create trigger ticket_events_to_operations
  after insert on public.ticket_events
  for each row execute function private.sync_ticket_to_operations();

-- Booking events → operations_events
create or replace function private.sync_booking_to_operations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.operations_events (organization_id, subject_type, subject_id, event_type, actor_type, actor_id, metadata)
  values (new.organization_id, 'BOOKING', new.booking_id, new.event_type, new.actor_type, new.actor_id, coalesce(new.payload, '{}'::jsonb));
  return new;
end;
$$;
revoke all on function private.sync_booking_to_operations() from public, anon, authenticated, service_role;

drop trigger if exists booking_events_to_operations on public.booking_events;
create trigger booking_events_to_operations
  after insert on public.booking_events
  for each row execute function private.sync_booking_to_operations();

-- Presence events → operations_events
create or replace function private.sync_presence_to_operations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.operations_events (organization_id, subject_type, subject_id, event_type, actor_type, actor_id, metadata)
  values (new.organization_id, 'SESSION', coalesce(new.subject_id, new.session_id), new.event_type, new.actor_type, new.actor_id, new.metadata);
  return new;
end;
$$;
revoke all on function private.sync_presence_to_operations() from public, anon, authenticated, service_role;

drop trigger if exists presence_events_to_operations on public.presence_events;
create trigger presence_events_to_operations
  after insert on public.presence_events
  for each row execute function private.sync_presence_to_operations();

-- Timeline read API (authorized)
create or replace function public.get_subject_timeline(
  p_organization_id uuid,
  p_subject_type text,
  p_subject_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not private.school_staff(p_organization_id)
     and not exists (
       select 1 from public.business_members bm
       where bm.business_id = p_organization_id
         and bm.clerk_user_id = auth.uid()::text
     )
  then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'event_type', event_type,
    'actor_type', actor_type,
    'actor_id', actor_id,
    'metadata', metadata,
    'created_at', created_at
  ) order by created_at), '[]'::jsonb)
  into result
  from public.operations_events
  where organization_id = p_organization_id
    and subject_type = p_subject_type
    and subject_id = p_subject_id;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'subject_type', p_subject_type,
    'subject_id', p_subject_id,
    'events', result
  );
end;
$$;

revoke all on function public.get_subject_timeline(uuid, text, uuid) from public, anon;
grant execute on function public.get_subject_timeline(uuid, text, uuid) to authenticated, service_role;
