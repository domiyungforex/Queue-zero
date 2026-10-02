begin;
create table public.queue_operation_requests (
 queue_id uuid not null references public.queues(id), request_id uuid not null,
 actor_user_id text not null, operation text not null, ticket_id uuid,
 result jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(queue_id,request_id), foreign key(ticket_id,queue_id) references public.tickets(id,queue_id)
);
alter table public.queue_operation_requests enable row level security;
alter table public.queue_operation_requests force row level security;
revoke all on public.queue_operation_requests from public,anon,authenticated,service_role;
grant select on public.queue_operation_requests to service_role;

create function private.lock_operable_queue(p_queue_id uuid) returns public.queues
language plpgsql security definer set search_path='' as $$
declare q public.queues; m public.business_members;
begin
 if not private.can_access_queue(p_queue_id) then raise exception 'Queue access required' using errcode='42501'; end if;
 select * into q from public.queues where id=p_queue_id for update;
 select * into m from public.business_members where business_id=q.business_id and clerk_user_id=private.current_clerk_user_id() for share;
 if not found then raise exception 'Queue access required' using errcode='42501'; end if;
 if m.role='staff' then
  perform 1 from public.queue_staff_assignments where queue_id=q.id and business_member_id=m.id for share;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;
 end if;
 return q;
end $$;
revoke all on function private.lock_operable_queue(uuid) from public,anon,authenticated,service_role;

create function public.operate_ticket(p_queue_id uuid,p_ticket_id uuid,p_operation text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.queues; t public.tickets; old public.queue_operation_requests; result jsonb; stamp timestamptz:=clock_timestamp(); actor text:=private.current_clerk_user_id();
begin
 if p_request_id is null or p_ticket_id is null or p_operation not in ('complete','no_show','recall','cancel') or p_operation is null then raise exception 'Invalid operation' using errcode='22023'; end if;
 q:=private.lock_operable_queue(p_queue_id);
 select * into old from public.queue_operation_requests where queue_id=q.id and request_id=p_request_id;
 if found then
  if old.actor_user_id<>actor or old.operation<>p_operation or old.ticket_id<>p_ticket_id then raise exception 'Request unavailable' using errcode='42501'; end if;
  return old.result||jsonb_build_object('replayed',true);
 end if;
 select * into t from public.tickets where id=p_ticket_id and queue_id=q.id for update;
 if not found then raise exception 'Ticket unavailable' using errcode='42501'; end if;
 if (p_operation in ('complete','recall') and t.status<>'serving') or (p_operation='no_show' and t.status not in ('waiting','serving')) or (p_operation='cancel' and t.status<>'waiting') then
  raise exception 'Ticket has changed. Refresh the queue.' using errcode='QZ007';
 end if;
 if p_operation='complete' then update public.tickets set status='completed',completed_at=stamp where id=t.id;
 elsif p_operation='no_show' then update public.tickets set status='no_show',no_show_at=stamp where id=t.id;
 elsif p_operation='cancel' then update public.tickets set status='cancelled',cancelled_at=stamp where id=t.id;
 end if;
 insert into public.ticket_events(ticket_id,queue_id,type,actor_type,actor_id,metadata,created_at)
 values(t.id,q.id,(case p_operation when 'complete' then 'completed' when 'cancel' then 'cancelled' when 'recall' then 'recalled' else 'no_show' end)::public.ticket_event_type,'staff',actor,jsonb_build_object('request_id',p_request_id),stamp);
 result:=jsonb_build_object('ok',true,'replayed',false,'display_number',t.display_number,'operation',p_operation);
 insert into public.queue_operation_requests values(q.id,p_request_id,actor,p_operation,t.id,result,stamp);
 return result;
end $$;
revoke all on function public.operate_ticket(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.operate_ticket(uuid,uuid,text,uuid) to authenticated;

create function public.operate_queue(p_queue_id uuid,p_status public.queue_status,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.queues; old public.queue_operation_requests; result jsonb; actor text:=private.current_clerk_user_id();
begin
 if p_request_id is null or p_status is null then raise exception 'Invalid operation' using errcode='22023'; end if;
 q:=private.lock_operable_queue(p_queue_id);
 if p_status='closed' and private.business_role_for(q.business_id)='staff' then raise exception 'Manager required' using errcode='42501'; end if;
 select * into old from public.queue_operation_requests where queue_id=q.id and request_id=p_request_id;
 if found then
  if old.actor_user_id<>actor or old.operation<>'queue_'||p_status::text then raise exception 'Request unavailable' using errcode='42501'; end if;
  return old.result||jsonb_build_object('replayed',true);
 end if;
 if q.status<>p_status then
  update public.queues set status=p_status where id=q.id;
  insert into public.business_events(business_id,type,actor_user_id,metadata) values(q.business_id,'queue_status_changed',actor,jsonb_build_object('queue_id',q.id,'status',p_status));
 end if;
 result:=jsonb_build_object('ok',true,'status',p_status,'replayed',false);
 insert into public.queue_operation_requests(queue_id,request_id,actor_user_id,operation,result) values(q.id,p_request_id,actor,'queue_'||p_status::text,result);
 return result;
end $$;
revoke all on function public.operate_queue(uuid,public.queue_status,uuid) from public,anon,authenticated,service_role;
grant execute on function public.operate_queue(uuid,public.queue_status,uuid) to authenticated;
commit;
