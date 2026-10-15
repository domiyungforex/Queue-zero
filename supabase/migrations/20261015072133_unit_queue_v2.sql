create or replace function private.default_queue_service_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.service_name is null or btrim(new.service_name) = '' then
    new.service_name := new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists default_queue_service_name on public.queues;
create trigger default_queue_service_name
before insert on public.queues
for each row execute function private.default_queue_service_name();

-- The accountless attendance migration intentionally uses one stable nonce for
-- the class window. Older migrations merged from the mobile branch replaced
-- this with nonce rotation, so make the final schema preserve the approved flow.
create or replace function public.school_issue_qr(
  p_class_id uuid,
  p_nonce uuid,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cls public.class_sessions%rowtype;
  org uuid;
  issued public.attendance_qr_nonces%rowtype;
  expiry timestamptz;
begin
  select * into cls from public.class_sessions where id = p_class_id;
  if not found then raise exception 'Class unavailable' using errcode = '42501'; end if;
  org := private.school_lock_course(cls.course_id);
  select * into cls from public.class_sessions where id = p_class_id for update;
  if cls.qr_revoked_at is not null
    or not cls.arrival_open
    or not exists(select 1 from public.sessions where id = p_class_id and status = 'OPEN')
  then
    raise exception 'Attendance is closed' using errcode = '22023';
  end if;
  if cls.attendance_closes_at is not null and cls.attendance_closes_at <= clock_timestamp() then
    raise exception 'Attendance is closed' using errcode = '22023';
  end if;
  select * into issued
  from public.attendance_qr_nonces
  where class_session_id = p_class_id and expires_at > clock_timestamp()
  order by created_at desc
  limit 1;
  if not found then
    expiry := least(
      coalesce(cls.attendance_closes_at, cls.planned_ends_at, clock_timestamp() + interval '12 hours'),
      clock_timestamp() + interval '18 hours'
    );
    if expiry <= clock_timestamp() then
      raise exception 'Attendance is closed' using errcode = '22023';
    end if;
    insert into public.attendance_qr_nonces(nonce,organization_id,class_session_id,expires_at)
    values(p_nonce,org,p_class_id,expiry)
    returning * into issued;
  end if;
  return jsonb_build_object(
    'organization_id',org,
    'session_id',p_class_id,
    'nonce',issued.nonce,
    'issued_at',issued.created_at,
    'expires_at',issued.expires_at
  );
end;
$$;

revoke all on function public.school_issue_qr(uuid,uuid,timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.school_issue_qr(uuid,uuid,timestamptz) to authenticated;

create or replace function public.create_unit_queue_v2(
  p_queue_id uuid,
  p_business_id uuid,
  p_location_id uuid,
  p_name text,
  p_service_name text,
  p_description text,
  p_average_service_seconds integer,
  p_warning_threshold integer,
  p_allow_phone boolean,
  p_require_phone boolean,
  p_capacity integer,
  p_opens_at time without time zone,
  p_closes_at time without time zone,
  p_status public.queue_status,
  p_unit_id uuid
) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_id uuid;
  existed boolean;
begin
  select exists(
    select 1 from public.queues
    where id = p_queue_id and business_id = p_business_id and unit_id = p_unit_id
  ) into existed;

  queue_id := public.create_unit_queue(
    p_queue_id,
    p_business_id,
    p_location_id,
    p_name,
    p_description,
    p_average_service_seconds,
    p_warning_threshold,
    p_allow_phone,
    p_require_phone,
    p_unit_id
  );

  if existed then
    return queue_id;
  end if;

  if p_service_name is null or char_length(btrim(p_service_name)) not between 1 and 160
    or (p_capacity is not null and p_capacity not between 1 and 1000)
    or ((p_opens_at is null) <> (p_closes_at is null))
    or (p_opens_at is not null and p_opens_at = p_closes_at)
    or p_status is null
  then
    raise exception 'Invalid queue settings' using errcode = '22023';
  end if;

  update public.queues
  set service_name = btrim(p_service_name),
      capacity = p_capacity,
      opens_at = p_opens_at,
      closes_at = p_closes_at,
      status = p_status
  where id = queue_id and business_id = p_business_id and unit_id = p_unit_id;

  return queue_id;
end;
$$;

revoke all on function public.create_unit_queue_v2(
  uuid,uuid,uuid,text,text,text,integer,integer,boolean,boolean,integer,time,time,public.queue_status,uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_unit_queue_v2(
  uuid,uuid,uuid,text,text,text,integer,integer,boolean,boolean,integer,time,time,public.queue_status,uuid
) to authenticated;
