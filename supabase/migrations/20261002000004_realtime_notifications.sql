begin;
alter table public.notifications add column attempts integer not null default 0;
alter table public.notifications add column lease_token uuid;
alter table public.notifications add column lease_until timestamptz;
alter table public.notifications add column next_attempt_at timestamptz not null default now();
create index notifications_delivery_queue on public.notifications(next_attempt_at) where status='pending';

create function private.publish_queue_change(p_queue_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.queues; t record; payload jsonb:=jsonb_build_object('changed',true);
begin
 select * into q from public.queues where id=p_queue_id;
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  execute 'select realtime.send($1,$2,$3,true)' using payload,'changed','queue:'||q.id;
  execute 'select realtime.send($1,$2,$3,true)' using payload,'changed','business:'||q.business_id;
  execute 'select realtime.send($1,$2,$3,true)' using payload,'changed','public-queue:'||q.slug;
  for t in select public_token from public.tickets where queue_id=q.id and (status in ('waiting','serving') or updated_at>now()-interval '1 minute') loop
   execute 'select realtime.send($1,$2,$3,true)' using payload,'changed','ticket:'||t.public_token;
  end loop;
 end if;
exception when others then
 -- Broadcast is best effort; reconnect/polling refetches database truth.
 raise warning 'Queue broadcast unavailable';
end $$;
revoke all on function private.publish_queue_change(uuid) from public,anon,authenticated,service_role;

create function private.queue_side_effects() returns trigger
language plpgsql security definer set search_path='' as $$
declare qid uuid; q public.queues;
begin
 if tg_table_name='queues' then qid:=new.id; else qid:=new.queue_id; end if;
 select * into q from public.queues where id=qid;
 perform private.publish_queue_change(qid);
 if tg_table_name='queues' and new.status::text='paused' and old.status::text is distinct from new.status::text then
  insert into public.notifications(ticket_id,channel,type,deduplication_key)
   select id,'web_push','queue_paused',id::text||':paused:'||q.revision from public.tickets where queue_id=q.id and status in ('waiting','serving') on conflict do nothing;
 end if;
 if q.status='open' then
  insert into public.notifications(ticket_id,channel,type,deduplication_key)
   select id,'web_push','almost_your_turn',id::text||':almost' from (select id,row_number() over(order by joined_at,id)-1 ahead from public.tickets where queue_id=q.id and status='waiting') w
   where ahead<=q.warning_threshold on conflict do nothing;
 end if;
 return new;
exception when others then
 raise warning 'Queue side effects unavailable';return new;
end $$;
revoke all on function private.queue_side_effects() from public,anon,authenticated,service_role;
create trigger tickets_side_effects after insert or update of status on public.tickets for each row execute function private.queue_side_effects();
create trigger queues_side_effects after update of status on public.queues for each row execute function private.queue_side_effects();
create function private.ticket_event_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.type in ('called','recalled') then
  insert into public.notifications(ticket_id,channel,type,deduplication_key) values(new.ticket_id,'web_push','your_turn',new.id::text||':called') on conflict do nothing;
  perform private.publish_queue_change(new.queue_id);
 end if;return new;
exception when others then raise warning 'Ticket notification unavailable';return new;
end $$;
revoke all on function private.ticket_event_notifications() from public,anon,authenticated,service_role;
create trigger ticket_event_notifications after insert on public.ticket_events for each row execute function private.ticket_event_notifications();

-- Policies authorize reception of payload-free invalidations. Ticket topic names
-- are bearer capabilities; public queue topics reveal no customer information.
create function public.queuezero_receive_topic(p_topic text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_topic ~ '^ticket:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 or p_topic ~ '^public-queue:[a-z0-9-]{3,100}$'
 or exists(select 1 from public.queues q where p_topic='queue:'||q.id::text and private.can_access_queue(q.id))
 or exists(select 1 from public.business_members m where p_topic='business:'||m.business_id::text and m.clerk_user_id=private.current_clerk_user_id());
$$;
revoke all on function public.queuezero_receive_topic(text) from public,anon,authenticated,service_role;
grant execute on function public.queuezero_receive_topic(text) to anon,authenticated;
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute $policy$create policy queuezero_receive on realtime.messages for select to anon,authenticated using (extension='broadcast' and public.queuezero_receive_topic(realtime.topic()))$policy$;
 end if;
end $$;

create function public.register_ticket_push(p_token uuid,p_endpoint text,p_p256dh text,p_auth text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tickets;
begin
 select * into t from public.tickets where public_token=p_token and status in ('waiting','serving') for update;
 if not found then raise exception 'Ticket unavailable' using errcode='22023'; end if;
 if p_endpoint is null or length(p_endpoint)>4096 or p_endpoint !~ '^https://' or p_p256dh is null or length(p_p256dh) not between 20 and 512 or p_auth is null or length(p_auth) not between 10 and 512 then raise exception 'Invalid subscription' using errcode='22023'; end if;
 if (select count(*) from public.push_subscriptions where ticket_id=t.id)>=5 and not exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and ticket_id=t.id) then raise exception 'Subscription limit' using errcode='22023'; end if;
 -- One browser endpoint follows its most recently enabled ticket.
 insert into public.push_subscriptions(ticket_id,endpoint,p256dh,auth) values(t.id,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set ticket_id=excluded.ticket_id,clerk_user_id=null,p256dh=excluded.p256dh,auth=excluded.auth;
 update public.notifications set status='pending',attempts=0,next_attempt_at=now(),lease_token=null,lease_until=null
 where id in (select distinct on(type) id from public.notifications where ticket_id=t.id and status='skipped' and ((type='almost_your_turn' and t.status='waiting') or (type='your_turn' and t.status='serving')) order by type,created_at desc);
end $$;
revoke all on function public.register_ticket_push(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.register_ticket_push(uuid,text,text,text) to service_role;

create function public.claim_notifications(p_limit integer default 20) returns setof public.notifications
language sql volatile security definer set search_path='' as $$
 update public.notifications set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1
 where id in(select id from public.notifications where status='pending' and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by created_at for update skip locked limit least(greatest(p_limit,1),50)) returning *;
$$;
revoke all on function public.claim_notifications(integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_notifications(integer) to service_role;
commit;
