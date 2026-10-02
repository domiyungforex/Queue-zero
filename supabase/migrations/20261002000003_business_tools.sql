begin;
create function public.get_queue_console(p_queue_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q public.queues; result jsonb; avg_seconds integer;
begin
 if not private.can_access_queue(p_queue_id) then raise exception 'Queue access required' using errcode='42501'; end if;
 select * into q from public.queues where id=p_queue_id;
 avg_seconds:=private.queue_service_seconds(q.id);
 select jsonb_build_object('queue_id',q.id,'name',q.name,'slug',q.slug,'status',q.status,'average_service_seconds',avg_seconds,'warning_threshold',q.warning_threshold,
 'waiting',coalesce((select jsonb_agg(x order by x.joined_at,x.id) from (select id,display_number,customer_name,joined_at,status,((row_number() over(order by joined_at,id)-1)*avg_seconds)::integer as estimated_wait_seconds from public.tickets where queue_id=q.id and status='waiting') x),'[]'::jsonb),
 'serving',(select jsonb_build_object('id',id,'display_number',display_number,'customer_name',customer_name,'called_at',called_at,'status',status) from public.tickets where queue_id=q.id and status='serving'),
 'served_today',(select count(*) from public.tickets t join public.locations l on l.id=q.location_id where t.queue_id=q.id and t.completed_at>=((now() at time zone l.timezone)::date at time zone l.timezone)),
 'no_shows_today',(select count(*) from public.tickets t join public.locations l on l.id=q.location_id where t.queue_id=q.id and t.no_show_at>=((now() at time zone l.timezone)::date at time zone l.timezone))) into result;
 return result;
end $$;
revoke all on function public.get_queue_console(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_queue_console(uuid) to authenticated;

create function public.business_metrics(p_business_id uuid,p_days integer default 7) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; today date; start_at timestamptz; result jsonb;
begin
 if private.business_role_for(p_business_id) is null then raise exception 'Membership required' using errcode='42501'; end if;
 if p_days not between 1 and 90 or p_days is null then raise exception 'Invalid date range' using errcode='22023'; end if;
 select timezone into tz from public.businesses where id=p_business_id;
 today:=(now() at time zone tz)::date;start_at:=((today-(p_days-1))::timestamp at time zone tz);
 with accessible as (select id from public.queues where business_id=p_business_id and private.can_access_queue(id)),
 recent as (select t.* from public.tickets t join accessible q on q.id=t.queue_id where t.joined_at>=start_at),
 days as (select generate_series(today-(p_days-1),today,interval '1 day')::date as day)
 select jsonb_build_object('timezone',tz,'days',p_days,
 'waiting',(select count(*) from public.tickets where queue_id in(select id from accessible) and status='waiting'),
 'serving',(select count(*) from public.tickets where queue_id in(select id from accessible) and status='serving'),
 'joins', (select count(*) from recent),'joins_today',(select count(*) from recent where (joined_at at time zone tz)::date=today),
 'completed',(select count(*) from recent where status='completed'),
 'completed_today',(select count(*) from public.tickets where queue_id in(select id from accessible) and completed_at >= (today::timestamp at time zone tz)),
 'no_shows',(select count(*) from recent where status='no_show'),
 'cancelled',(select count(*) from recent where status='cancelled'),
 'average_wait_seconds',(select round(avg(extract(epoch from called_at-joined_at))) from recent where called_at is not null),
 'average_service_seconds',(select round(avg(extract(epoch from completed_at-called_at))) from recent where status='completed'),
 'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',day,'joins',(select count(*) from recent where (joined_at at time zone tz)::date=day),'average_wait_seconds',(select round(avg(extract(epoch from called_at-joined_at))) from recent where called_at is not null and (joined_at at time zone tz)::date=day)) order by day),'[]'::jsonb) from days),
 'hourly',(select jsonb_agg(jsonb_build_object('hour',h,'joins',(select count(*) from recent where extract(hour from joined_at at time zone tz)=h)) order by h) from generate_series(0,23) h)
 ) into result;
 return result;
end $$;
revoke all on function public.business_metrics(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_metrics(uuid,integer) to authenticated;

create function public.save_location(p_business_id uuid,p_location_id uuid,p_name text,p_address text,p_timezone text,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor text:=private.current_clerk_user_id(); existing public.locations;
begin
 if private.business_role_for(p_business_id) not in ('owner','admin') or private.business_role_for(p_business_id) is null then raise exception 'Manager required' using errcode='42501'; end if;
 if p_location_id is null or p_active is null or p_name is null or length(btrim(p_name)) not between 1 and 160 or p_address is null or length(btrim(p_address)) not between 1 and 500 or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid location' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_location_id::text,3));
 select * into existing from public.locations where id=p_location_id for update;
 if found and existing.business_id<>p_business_id then raise exception 'Location unavailable' using errcode='42501'; end if;
 insert into public.locations(id,business_id,name,address,timezone,is_active) values(p_location_id,p_business_id,btrim(p_name),btrim(p_address),p_timezone,p_active)
 on conflict(id) do update set name=excluded.name,address=excluded.address,timezone=excluded.timezone,is_active=excluded.is_active;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_business_id,'location_saved',actor,jsonb_build_object('location_id',p_location_id));
 return p_location_id;
end $$;
revoke all on function public.save_location(uuid,uuid,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_location(uuid,uuid,text,text,text,boolean) to authenticated;

create function public.save_business(p_business_id uuid,p_name text,p_industry text,p_timezone text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if private.business_role_for(p_business_id) is distinct from 'owner' then raise exception 'Owner required' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 160 or p_industry is null or length(btrim(p_industry)) not between 1 and 100 or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid business' using errcode='22023'; end if;
 update public.businesses set name=btrim(p_name),industry=btrim(p_industry),timezone=p_timezone where id=p_business_id;
 insert into public.business_events(business_id,type,actor_user_id) values(p_business_id,'business_updated',private.current_clerk_user_id());
 return p_business_id;
end $$;
revoke all on function public.save_business(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.save_business(uuid,text,text,text) to authenticated;

create function public.save_staff(p_business_id uuid,p_user_id text,p_role public.business_role,p_queue_ids uuid[],p_remove boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor_role public.business_role:=private.business_role_for(p_business_id); member_id uuid; old_role public.business_role;
begin
 if actor_role is null or actor_role='staff' then raise exception 'Manager required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id)>255 or p_role is null or p_role='owner' or p_queue_ids is null or cardinality(p_queue_ids)>100 or p_remove is null then raise exception 'Invalid member' using errcode='22023'; end if;
 if p_user_id=private.current_clerk_user_id() then raise exception 'Cannot edit your own membership' using errcode='42501'; end if;
 -- Queue-first lock order matches operations and prevents revocation midway through a call.
 perform 1 from public.queues where business_id=p_business_id order by id for update;
 select id,role into member_id,old_role from public.business_members where business_id=p_business_id and clerk_user_id=p_user_id for update;
 if old_role='owner' or (actor_role='admin' and (p_role='admin' or old_role='admin')) then raise exception 'Owner required' using errcode='42501'; end if;
 if exists(select 1 from unnest(p_queue_ids) a where not exists(select 1 from public.queues where id=a and business_id=p_business_id)) then raise exception 'Foreign queue' using errcode='42501'; end if;
 if p_remove then
  if member_id is not null then delete from public.queue_staff_assignments where business_member_id=member_id;delete from public.business_members where id=member_id;end if;
 else
  insert into public.business_members(business_id,clerk_user_id,role) values(p_business_id,p_user_id,p_role)
  on conflict(business_id,clerk_user_id) do update set role=excluded.role returning id into member_id;
  delete from public.queue_staff_assignments where business_member_id=member_id;
  insert into public.queue_staff_assignments(business_id,queue_id,business_member_id) select p_business_id,id,member_id from public.queues where business_id=p_business_id and id=any(p_queue_ids);
 end if;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_business_id,case when p_remove then 'staff_removed' else 'staff_saved' end,private.current_clerk_user_id(),jsonb_build_object('member_id',member_id,'role',p_role));
 return member_id;
end $$;
revoke all on function public.save_staff(uuid,text,public.business_role,uuid[],boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_staff(uuid,text,public.business_role,uuid[],boolean) to authenticated;
commit;
