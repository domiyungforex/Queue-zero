begin;

-- Retain action outcomes so an ambiguous network retry never advances a second
-- customer, even after the first ticket has completed. Nonces are queue-scoped.
create table public.queue_call_requests (
  queue_id uuid not null references public.queues(id) on delete restrict,
  request_id uuid not null,
  actor_user_id text not null check (char_length(actor_user_id) between 1 and 255),
  outcome text not null check (outcome in ('called','already_serving','empty')),
  ticket_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  primary key (queue_id,request_id),
  foreign key (ticket_id,queue_id) references public.tickets(id,queue_id) on delete restrict,
  check ((outcome='empty')=(ticket_id is null))
);
create index queue_call_requests_ticket on public.queue_call_requests(ticket_id,queue_id);
alter table public.queue_call_requests enable row level security;
alter table public.queue_call_requests force row level security;
revoke all on public.queue_call_requests from public,anon,authenticated,service_role;
grant select on public.queue_call_requests to service_role;

create function public.call_next_ticket(p_queue_id uuid,p_request_id uuid)
returns table(outcome text,replayed boolean,ticket_id uuid,display_number text,
  customer_name text,called_at timestamptz,ticket_status public.ticket_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor text := private.current_clerk_user_id();
  q public.queues%rowtype;
  member public.business_members%rowtype;
  prior public.queue_call_requests%rowtype;
  chosen public.tickets%rowtype;
  result_outcome text;
  called_time timestamptz;
begin
  if p_queue_id is null or p_request_id is null then
    raise exception 'Queue and request IDs required' using errcode='22023';
  end if;
  -- Reject unknown/foreign queues identically, before taking a tenant row lock.
  if actor is null or not private.can_access_queue(p_queue_id) then
    raise exception 'Queue access required' using errcode='42501';
  end if;
  select * into q from public.queues where id=p_queue_id for update;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;

  -- Recheck permissions AFTER waiting for the queue lock. Share locks prevent
  -- membership/assignment revocation from committing midway through the action.
  select * into member from public.business_members
    where business_id=q.business_id and clerk_user_id=actor for share;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  if member.role='staff' then
    perform 1 from public.queue_staff_assignments
      where queue_id=q.id and business_member_id=member.id and business_id=q.business_id for share;
    if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  end if;

  select * into prior from public.queue_call_requests r where r.queue_id=q.id and r.request_id=p_request_id;
  if found then
    if prior.actor_user_id<>actor then raise exception 'Request unavailable' using errcode='42501'; end if;
    return query select prior.outcome,true,t.id,t.display_number,t.customer_name,t.called_at,t.status
      from (values(1)) as one(n) left join public.tickets t on t.id=prior.ticket_id and t.queue_id=q.id;
    return;
  end if;

  perform 1 from public.locations where id=q.location_id and business_id=q.business_id and is_active for share;
  if not found or q.status<>'open' then
    raise exception 'Queue is not available for calling' using errcode='QZ002';
  end if;
  select * into chosen from public.tickets where queue_id=q.id and status='serving' for update;
  if found then
    result_outcome := 'already_serving';
  else
    -- Do not SKIP LOCKED: queue-level serialization preserves strict FIFO,
    -- including customers from yesterday after daily number resets.
    select * into chosen from public.tickets where queue_id=q.id and status='waiting'
      order by joined_at,id limit 1 for update;
    if not found then
      result_outcome := 'empty';
    else
      called_time := clock_timestamp();
      update public.tickets set status='serving',called_at=called_time,estimated_wait_seconds=0
        where id=chosen.id returning * into chosen;
      insert into public.ticket_events(ticket_id,queue_id,type,actor_type,actor_id,metadata,created_at)
        values(chosen.id,q.id,'called','staff',actor,jsonb_build_object('request_id',p_request_id),called_time);
      result_outcome := 'called';
    end if;
  end if;
  insert into public.queue_call_requests(queue_id,request_id,actor_user_id,outcome,ticket_id)
    values(q.id,p_request_id,actor,result_outcome,chosen.id);
  return query select result_outcome,false,chosen.id,chosen.display_number,chosen.customer_name,chosen.called_at,chosen.status;
end;
$$;
revoke all on function public.call_next_ticket(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.call_next_ticket(uuid,uuid) to authenticated;

commit;
