begin;

-- Monotonic revisions prevent one manager's stale form overwriting another's work.
alter table public.queues add column revision integer not null default 1 check (revision > 0);
create function private.increment_queue_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function private.increment_queue_revision() from public, anon, authenticated, service_role;
create trigger queues_revision before update on public.queues
  for each row execute function private.increment_queue_revision();

create function private.validate_queue_settings(
  p_name text, p_description text, p_average_service_seconds integer,
  p_warning_threshold integer, p_allow_phone boolean, p_require_phone boolean
) returns void language plpgsql set search_path = '' as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160
    or char_length(p_description) > 2000
    or p_average_service_seconds is null or p_average_service_seconds not between 1 and 86400
    or p_warning_threshold is null or p_warning_threshold not between 0 and 100
    or p_allow_phone is null or p_require_phone is null
    or (p_require_phone and not p_allow_phone)
  then raise exception 'Invalid queue settings' using errcode = '22023'; end if;
end;
$$;
revoke all on function private.validate_queue_settings(text,text,integer,integer,boolean,boolean) from public, anon, authenticated, service_role;

create function public.create_queue(
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

create function public.update_queue(
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

create function public.set_queue_status(
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

revoke all on function public.create_queue(uuid,uuid,uuid,text,text,integer,integer,boolean,boolean) from public, anon, authenticated, service_role;
revoke all on function public.update_queue(uuid,uuid,integer,uuid,text,text,integer,integer,boolean,boolean) from public, anon, authenticated, service_role;
revoke all on function public.set_queue_status(uuid,uuid,integer,public.queue_status) from public, anon, authenticated, service_role;
grant execute on function public.create_queue(uuid,uuid,uuid,text,text,integer,integer,boolean,boolean) to authenticated;
grant execute on function public.update_queue(uuid,uuid,integer,uuid,text,text,integer,integer,boolean,boolean) to authenticated;
grant execute on function public.set_queue_status(uuid,uuid,integer,public.queue_status) to authenticated;

commit;
