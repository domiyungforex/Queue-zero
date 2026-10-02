begin;
drop function public.get_public_ticket(uuid);
create function public.get_public_ticket(p_token uuid)
returns table(display_number text,status public.ticket_status,joined_at timestamptz,business_name text,queue_name text,queue_slug text,location_name text,location_timezone text,queue_status public.queue_status,location_active boolean,people_ahead bigint,estimated_wait_seconds bigint,has_serving_customer boolean,warning_threshold integer)
language sql stable security definer set search_path='' as $$
 select t.display_number,t.status,t.joined_at,b.name,q.name,q.slug,l.name,l.timezone,q.status,l.is_active,
 case when t.status='waiting' then position.ahead else null end,
 case when t.status='waiting' and q.status='open' and l.is_active then position.ahead*private.queue_service_seconds(q.id) else null end,
 exists(select 1 from public.tickets s where s.queue_id=q.id and s.status='serving'),q.warning_threshold
 from public.tickets t join public.queues q on q.id=t.queue_id join public.businesses b on b.id=q.business_id join public.locations l on l.id=q.location_id and l.business_id=q.business_id
 cross join lateral(select count(*) as ahead from public.tickets w where w.queue_id=t.queue_id and w.status='waiting' and (w.joined_at,w.id)<(t.joined_at,t.id)) position where t.public_token=p_token;
$$;
revoke all on function public.get_public_ticket(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_ticket(uuid) to anon,authenticated;
create function public.get_public_display(p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('business_name',b.name,'queue_name',q.name,'status',q.status,'now_serving',(select display_number from public.tickets where queue_id=q.id and status='serving'),'waiting_count',(select count(*) from public.tickets where queue_id=q.id and status='waiting'),'next_numbers',coalesce((select jsonb_agg(display_number) from(select display_number from public.tickets where queue_id=q.id and status='waiting' order by joined_at,id limit 5) w),'[]'::jsonb))
 from public.queues q join public.businesses b on b.id=q.business_id join public.locations l on l.id=q.location_id where q.slug=p_slug and l.is_active;
$$;
revoke all on function public.get_public_display(text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_display(text) to anon,authenticated;
commit;
