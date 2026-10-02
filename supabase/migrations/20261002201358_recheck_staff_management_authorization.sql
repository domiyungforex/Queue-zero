begin;
-- Lock current membership only after queue/resource locks. Revocation cannot
-- leave a queued administrative operation authorized by its pre-wait snapshot.
create function private.lock_business_manager(p_business_id uuid) returns public.business_role
language plpgsql volatile security definer set search_path='' as $$
declare manager_role public.business_role;
begin
 select role into manager_role from public.business_members
 where business_id=p_business_id and clerk_user_id=private.current_clerk_user_id() for share;
 if manager_role is null or manager_role not in ('owner','admin') then
  raise exception 'Manager required' using errcode='42501';
 end if;
 return manager_role;
end $$;
revoke all on function private.lock_business_manager(uuid) from public,anon,authenticated,service_role;

create or replace function public.create_queue(
  p_queue_id uuid, p_business_id uuid, p_location_id uuid, p_name text,
  p_description text, p_average_service_seconds integer, p_warning_threshold integer,
  p_allow_phone boolean, p_require_phone boolean
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id text := private.current_clerk_user_id();
  existing_business uuid;
  queue_slug text;
begin
  if actor_id is null or coalesce(private.business_role_for(p_business_id) not in ('owner', 'admin'), true) then
    raise exception 'Queue management access required' using errcode = '42501';
  end if;
  if p_queue_id is null then raise exception 'Queue ID required' using errcode = '22023'; end if;
  -- The form carries a stable random queue ID: double submissions and retries
  -- after an ambiguous network failure create one queue and one audit event.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('queuezero:create:' || p_queue_id::text, 0));
  perform private.lock_business_manager(p_business_id);
  select business_id into existing_business from public.queues where id = p_queue_id;
  if found then
    if existing_business <> p_business_id then
      raise exception 'Queue unavailable' using errcode = '42501';
    end if;
    return p_queue_id;
  end if;
  perform private.validate_queue_settings(p_name, p_description, p_average_service_seconds, p_warning_threshold, p_allow_phone, p_require_phone);
  -- Lock against concurrent location deactivation while validating ownership.
  perform 1 from public.locations where id = p_location_id and business_id = p_business_id and is_active for share;
  if not found then raise exception 'Choose an active location in this business' using errcode = '22023'; end if;
  queue_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
  queue_slug := coalesce(nullif(rtrim(left(queue_slug, 60), '-'), ''), 'queue') || '-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.queues (id, business_id, location_id, name, slug, description, average_service_seconds, warning_threshold, allow_phone, require_phone)
    values (p_queue_id, p_business_id, p_location_id, btrim(p_name), queue_slug, nullif(btrim(p_description), ''), p_average_service_seconds, p_warning_threshold, p_allow_phone, p_require_phone);
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (p_business_id, 'queue_created', actor_id, jsonb_build_object('queue_id', p_queue_id, 'location_id', p_location_id));
  return p_queue_id;
end;
$$;

create or replace function public.update_queue(
  p_queue_id uuid, p_business_id uuid, p_expected_revision integer,
  p_location_id uuid, p_name text, p_description text, p_average_service_seconds integer,
  p_warning_threshold integer, p_allow_phone boolean, p_require_phone boolean
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  current_queue public.queues%rowtype;
  actor_id text := private.current_clerk_user_id();
begin
  if actor_id is null or coalesce(private.business_role_for(p_business_id) not in ('owner', 'admin'), true) then
    raise exception 'Queue management access required' using errcode = '42501';
  end if;
  select * into current_queue from public.queues where id = p_queue_id and business_id = p_business_id for update;
  if not found then raise exception 'Queue unavailable' using errcode = '42501'; end if;
  perform private.lock_business_manager(p_business_id);
  if p_expected_revision is distinct from current_queue.revision then
    raise exception 'Queue changed; reload before saving' using errcode = '40001';
  end if;
  perform private.validate_queue_settings(p_name, p_description, p_average_service_seconds, p_warning_threshold, p_allow_phone, p_require_phone);
  perform 1 from public.locations where id = p_location_id and business_id = p_business_id and is_active for share;
  if not found then raise exception 'Choose an active location in this business' using errcode = '22023'; end if;
  update public.queues set location_id = p_location_id, name = btrim(p_name), description = nullif(btrim(p_description), ''),
    average_service_seconds = p_average_service_seconds, warning_threshold = p_warning_threshold,
    allow_phone = p_allow_phone, require_phone = p_require_phone where id = p_queue_id;
  -- The public slug deliberately stays unchanged when names/settings change.
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (p_business_id, 'queue_updated', actor_id, jsonb_build_object('queue_id', p_queue_id, 'revision', current_queue.revision + 1));
  return p_queue_id;
end;
$$;

create or replace function public.set_queue_status(
  p_queue_id uuid, p_business_id uuid, p_expected_revision integer, p_status public.queue_status
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  current_queue public.queues%rowtype;
  actor_id text := private.current_clerk_user_id();
begin
  if actor_id is null or coalesce(private.business_role_for(p_business_id) not in ('owner', 'admin'), true) then
    raise exception 'Queue management access required' using errcode = '42501';
  end if;
  select * into current_queue from public.queues where id = p_queue_id and business_id = p_business_id for update;
  if not found then raise exception 'Queue unavailable' using errcode = '42501'; end if;
  perform private.lock_business_manager(p_business_id);
  if p_status is null then raise exception 'Queue status required' using errcode = '22023'; end if;
  if p_expected_revision is distinct from current_queue.revision then
    raise exception 'Queue changed; reload before saving' using errcode = '40001';
  end if;
  if current_queue.status = p_status then return p_queue_id; end if;
  update public.queues set status = p_status where id = p_queue_id;
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (p_business_id, 'queue_status_changed', actor_id,
      jsonb_build_object('queue_id', p_queue_id, 'from', current_queue.status, 'to', p_status));
  return p_queue_id;
end;
$$;

create or replace function public.save_location(p_business_id uuid,p_location_id uuid,p_name text,p_address text,p_timezone text,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor text:=private.current_clerk_user_id(); existing public.locations;
begin
 if private.business_role_for(p_business_id) not in ('owner','admin') or private.business_role_for(p_business_id) is null then raise exception 'Manager required' using errcode='42501'; end if;
 if p_location_id is null or p_active is null or p_name is null or length(btrim(p_name)) not between 1 and 160 or p_address is null or length(btrim(p_address)) not between 1 and 500 or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid location' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_location_id::text,3));
 select * into existing from public.locations where id=p_location_id for update;
 if found and existing.business_id<>p_business_id then raise exception 'Location unavailable' using errcode='42501'; end if;
 perform private.lock_business_manager(p_business_id);
 insert into public.locations(id,business_id,name,address,timezone,is_active) values(p_location_id,p_business_id,btrim(p_name),btrim(p_address),p_timezone,p_active)
 on conflict(id) do update set name=excluded.name,address=excluded.address,timezone=excluded.timezone,is_active=excluded.is_active;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_business_id,'location_saved',actor,jsonb_build_object('location_id',p_location_id));
 return p_location_id;
end $$;

create or replace function public.save_staff(p_business_id uuid,p_user_id text,p_role public.business_role,p_queue_ids uuid[],p_remove boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor_role public.business_role:=private.business_role_for(p_business_id); member_id uuid; old_role public.business_role;
begin
 if actor_role is null or actor_role='staff' then raise exception 'Manager required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id)>255 or p_role is null or p_role='owner' or p_queue_ids is null or cardinality(p_queue_ids)>100 or p_remove is null then raise exception 'Invalid member' using errcode='22023'; end if;
 if p_user_id=private.current_clerk_user_id() then raise exception 'Cannot edit your own membership' using errcode='42501'; end if;
 -- Queue-first lock order matches operations and prevents revocation midway through a call.
 perform 1 from public.queues where business_id=p_business_id order by id for update;
 actor_role:=private.lock_business_manager(p_business_id);
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
commit;
