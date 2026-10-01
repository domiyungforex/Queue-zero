begin;

-- The opaque token is a bearer capability. Return only this ticket's public
-- status and aggregate position; never include identity fields or internal IDs.
create function public.get_public_ticket(p_token uuid)
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
      then position.ahead*q.average_service_seconds else null end,
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
revoke all on function public.get_public_ticket(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_ticket(uuid) to anon,authenticated;

-- Lock queue before ticket, the same ordering used by joins and future staff
-- transitions. Cancellation is idempotent, including after a lost response.
create function public.cancel_public_ticket(p_token uuid)
returns public.ticket_status language plpgsql volatile security definer set search_path = '' as $$
declare
  target_queue uuid;
  ticket public.tickets%rowtype;
  changed_at timestamptz;
begin
  select queue_id into target_queue from public.tickets where public_token=p_token;
  if not found then raise exception 'Ticket unavailable' using errcode='QZ001'; end if;
  perform 1 from public.queues where id=target_queue for update;
  select * into ticket from public.tickets where public_token=p_token and queue_id=target_queue for update;
  if not found then raise exception 'Ticket unavailable' using errcode='QZ001'; end if;
  if ticket.status='cancelled' then return 'cancelled'; end if;
  if ticket.status<>'waiting' then
    raise exception 'Ticket is no longer waiting' using errcode='QZ007';
  end if;
  changed_at := clock_timestamp();
  update public.tickets set status='cancelled',cancelled_at=changed_at where id=ticket.id;
  insert into public.ticket_events(ticket_id,queue_id,type,actor_type,metadata,created_at)
    values(ticket.id,target_queue,'cancelled','customer','{}'::jsonb,changed_at);
  return 'cancelled';
end;
$$;
revoke all on function public.cancel_public_ticket(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_public_ticket(uuid) to service_role;

commit;
