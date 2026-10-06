create table public.queue_counters (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  queue_id uuid not null,
  name text not null check(char_length(btrim(name)) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(queue_id,name),
  unique(id,queue_id),
  foreign key(queue_id,business_id) references public.queues(id,business_id) on delete cascade
);

create index queue_counters_queue_lookup on public.queue_counters(queue_id,is_active);

create table public.queue_counter_assignments (
  counter_id uuid not null,
  queue_id uuid not null,
  business_member_id uuid not null references public.business_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(counter_id,business_member_id),
  foreign key(counter_id,queue_id) references public.queue_counters(id,queue_id) on delete cascade
);

create index queue_counter_assignments_member_lookup
  on public.queue_counter_assignments(business_member_id,queue_id);

alter table public.queue_counters enable row level security;
alter table public.queue_counter_assignments enable row level security;

create policy queue_counters_select on public.queue_counters
  for select to authenticated
  using(private.can_access_queue(queue_id));

create policy queue_counter_assignments_select on public.queue_counter_assignments
  for select to authenticated
  using(private.can_access_queue(queue_id));

revoke all on public.queue_counters from anon,authenticated;
revoke all on public.queue_counter_assignments from anon,authenticated;
grant select on public.queue_counters to authenticated;
grant select on public.queue_counter_assignments to authenticated;

alter table public.tickets
  add column counter_id uuid,
  add column called_by_member_id uuid references public.business_members(id) on delete set null;

alter table public.tickets
  add constraint tickets_counter_queue_fkey
  foreign key(counter_id,queue_id) references public.queue_counters(id,queue_id) on delete set null;

alter table public.queue_call_requests
  add column counter_id uuid;

drop index public.tickets_one_serving_per_queue;

create unique index tickets_one_legacy_serving_per_queue
  on public.tickets(queue_id)
  where status='serving' and counter_id is null;

create unique index tickets_one_serving_per_counter
  on public.tickets(queue_id,counter_id)
  where status='serving' and counter_id is not null;

create or replace function private.queue_serving_capacity(p_queue_id uuid)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select greatest(
    1,
    coalesce((
      select count(*)::integer
      from public.queue_counters c
      where c.queue_id=p_queue_id and c.is_active
    ),0)
  )
$$;

revoke all on function private.queue_serving_capacity(uuid) from public,anon,authenticated,service_role;

create or replace function public.call_next_ticket_v2(
  p_queue_id uuid,
  p_request_id uuid,
  p_counter_id uuid
) returns table(
  outcome text,
  replayed boolean,
  ticket_id uuid,
  display_number text,
  customer_name text,
  called_at timestamptz,
  ticket_status public.ticket_status,
  service_counter_id uuid,
  service_counter_name text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor text:=private.current_clerk_user_id();
  q public.queues%rowtype;
  member public.business_members%rowtype;
  prior public.queue_call_requests%rowtype;
  chosen public.tickets%rowtype;
  counter_row public.queue_counters%rowtype;
  result_outcome text;
  called_time timestamptz;
  has_counters boolean;
begin
  if p_queue_id is null or p_request_id is null then
    raise exception 'Queue and request IDs required' using errcode='22023';
  end if;
  if actor is null or not private.can_access_queue(p_queue_id) then
    raise exception 'Queue access required' using errcode='42501';
  end if;

  select * into q from public.queues where id=p_queue_id for update;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;

  select * into member
  from public.business_members
  where business_id=q.business_id and clerk_user_id=actor
  for share;
  if not found or member.role not in ('owner','admin','staff') then
    raise exception 'Queue access required' using errcode='42501';
  end if;

  if member.role='staff' then
    perform 1 from public.queue_staff_assignments
    where queue_id=q.id and business_member_id=member.id and business_id=q.business_id
    for share;
    if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  end if;

  select exists(
    select 1 from public.queue_counters c where c.queue_id=q.id and c.is_active
  ) into has_counters;

  if has_counters then
    if p_counter_id is null then
      raise exception 'Choose a service counter' using errcode='QZ008';
    end if;

    select * into counter_row
    from public.queue_counters c
    where c.id=p_counter_id
      and c.queue_id=q.id
      and c.business_id=q.business_id
      and c.is_active
    for share;
    if not found then raise exception 'Counter unavailable' using errcode='QZ008'; end if;

    if member.role='staff' and not exists(
      select 1
      from public.queue_counter_assignments a
      where a.counter_id=counter_row.id
        and a.queue_id=q.id
        and a.business_member_id=member.id
    ) then
      raise exception 'Counter assignment required' using errcode='42501';
    end if;
  elsif p_counter_id is not null then
    raise exception 'Counter unavailable' using errcode='QZ008';
  end if;

  select * into prior
  from public.queue_call_requests r
  where r.queue_id=q.id and r.request_id=p_request_id;

  if found then
    if prior.actor_user_id<>actor or prior.counter_id is distinct from p_counter_id then
      raise exception 'Request unavailable' using errcode='42501';
    end if;

    return query
      select prior.outcome,true,t.id,t.display_number,t.customer_name,t.called_at,t.status,
        t.counter_id,c.name
      from (values(1)) one(n)
      left join public.tickets t on t.id=prior.ticket_id and t.queue_id=q.id
      left join public.queue_counters c on c.id=t.counter_id;
    return;
  end if;

  perform 1
  from public.locations
  where id=q.location_id and business_id=q.business_id and is_active
  for share;

  if not found or q.status<>'open' then
    raise exception 'Queue is not available for calling' using errcode='QZ002';
  end if;

  if has_counters then
    select * into chosen
    from public.tickets t
    where t.queue_id=q.id and t.counter_id=p_counter_id and t.status='serving'
    for update;
  else
    select * into chosen
    from public.tickets t
    where t.queue_id=q.id and t.counter_id is null and t.status='serving'
    for update;
  end if;

  if found then
    result_outcome:='already_serving';
  else
    select * into chosen
    from public.tickets t
    where t.queue_id=q.id and t.status='waiting'
    order by t.joined_at,t.id
    limit 1
    for update;

    if not found then
      result_outcome:='empty';
    else
      called_time:=clock_timestamp();

      update public.tickets t
      set status='serving',
          called_at=called_time,
          estimated_wait_seconds=0,
          counter_id=p_counter_id,
          called_by_member_id=member.id
      where t.id=chosen.id
      returning * into chosen;

      insert into public.ticket_events(
        ticket_id,queue_id,type,actor_type,actor_id,metadata,created_at
      ) values(
        chosen.id,q.id,'called','staff',actor,
        jsonb_build_object(
          'request_id',p_request_id,
          'counter_id',p_counter_id,
          'counter_name',counter_row.name
        ),
        called_time
      );

      result_outcome:='called';
    end if;
  end if;

  insert into public.queue_call_requests(
    queue_id,request_id,actor_user_id,outcome,ticket_id,counter_id
  ) values(
    q.id,p_request_id,actor,result_outcome,chosen.id,p_counter_id
  );

  return query
    select result_outcome,false,chosen.id,chosen.display_number,chosen.customer_name,
      chosen.called_at,chosen.status,chosen.counter_id,counter_row.name;
end
$$;

revoke all on function public.call_next_ticket_v2(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.call_next_ticket_v2(uuid,uuid,uuid)
  to authenticated;
