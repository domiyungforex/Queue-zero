begin;

-- The existing notifications table is a customer push-delivery outbox. Staff
-- inbox state is deliberately separate so delivery retries and read state can
-- never affect one another.
create table public.workspace_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_event_id uuid not null unique references public.business_events(id) on delete cascade,
  type text not null check (type ~ '^[a-z][a-z_]{2,79}$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 240),
  href text check (href is null or (href like '/%' and char_length(href) <= 500)),
  created_at timestamptz not null default now()
);
create index workspace_notifications_business_time
  on public.workspace_notifications (business_id, created_at desc);

create table public.workspace_notification_reads (
  notification_id uuid not null references public.workspace_notifications(id) on delete cascade,
  clerk_user_id text not null check (char_length(btrim(clerk_user_id)) between 1 and 255),
  read_at timestamptz not null default clock_timestamp(),
  primary key (notification_id, clerk_user_id)
);
create index workspace_notification_reads_user
  on public.workspace_notification_reads (clerk_user_id, read_at desc);

alter table public.workspace_notifications enable row level security;
alter table public.workspace_notifications force row level security;
alter table public.workspace_notification_reads enable row level security;
alter table public.workspace_notification_reads force row level security;
revoke all on public.workspace_notifications, public.workspace_notification_reads
  from public, anon, authenticated, service_role;
grant select on public.workspace_notifications to authenticated;
grant select, insert, update, delete on public.workspace_notifications, public.workspace_notification_reads to service_role;

create policy workspace_notifications_member_read
on public.workspace_notifications for select to authenticated
using (exists (
  select 1 from public.business_members member
  where member.business_id = workspace_notifications.business_id
    and member.clerk_user_id = (select private.current_clerk_user_id())
));

create function private.enqueue_workspace_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  notification_title text;
  notification_message text;
  notification_href text;
  entity_id text := new.metadata->>'id';
begin
  case new.type
    when 'school_class' then
      notification_title := 'Class created';
      notification_message := 'A new class session is ready in this workspace.';
      notification_href := case when entity_id is not null then '/dashboard/attendance/' || entity_id else '/dashboard/classes' end;
    when 'school_open' then
      notification_title := 'Attendance opened';
      notification_message := 'Students can now record attendance for this class.';
      notification_href := case when entity_id is not null then '/dashboard/attendance/' || entity_id else '/dashboard/attendance' end;
    when 'school_close_arrival' then
      notification_title := 'Attendance closed';
      notification_message := 'New student arrivals are no longer accepted for this class.';
      notification_href := case when entity_id is not null then '/dashboard/attendance/' || entity_id else '/dashboard/attendance' end;
    when 'school_finish' then
      notification_title := 'Class completed';
      notification_message := 'The attendance register has been finalized.';
      notification_href := case when entity_id is not null then '/dashboard/attendance/' || entity_id else '/dashboard/attendance' end;
    when 'school_enroll' then
      notification_title := 'Roster updated';
      notification_message := 'The student roster changed in this workspace.';
      notification_href := '/dashboard/students';
    when 'staff_invited' then
      notification_title := 'Team invitation sent';
      notification_message := 'A new workspace invitation is waiting for acceptance.';
      notification_href := '/dashboard/team';
    when 'staff_invitation_accepted' then
      notification_title := 'New team member';
      notification_message := 'A teammate accepted their workspace invitation.';
      notification_href := '/dashboard/team';
    when 'staff_saved' then
      notification_title := 'Team access updated';
      notification_message := 'A teammate’s workspace access changed.';
      notification_href := '/dashboard/team';
    when 'staff_removed' then
      notification_title := 'Team access removed';
      notification_message := 'A teammate no longer has access to this workspace.';
      notification_href := '/dashboard/team';
    when 'queue_created' then
      notification_title := 'Queue created';
      notification_message := 'A new queue is available in this workspace.';
      notification_href := case when new.metadata->>'queue_id' is not null then '/dashboard/queues/' || (new.metadata->>'queue_id') else '/dashboard/queues' end;
    when 'queue_status_changed' then
      notification_title := 'Queue status changed';
      notification_message := 'A queue is now ' || coalesce(new.metadata->>'status', 'updated') || '.';
      notification_href := case when new.metadata->>'queue_id' is not null then '/dashboard/queues/' || (new.metadata->>'queue_id') else '/dashboard/queues' end;
    else
      return new;
  end case;

  insert into public.workspace_notifications (
    business_id, source_event_id, type, title, message, href, created_at
  ) values (
    new.business_id, new.id, new.type, notification_title,
    notification_message, notification_href, new.created_at
  ) on conflict (source_event_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_workspace_notification() from public, anon, authenticated, service_role;
create trigger business_event_workspace_notification
after insert on public.business_events
for each row execute function private.enqueue_workspace_notification();

create function public.workspace_notification_snapshot(
  p_business_id uuid,
  p_limit integer default 30
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor text := private.current_clerk_user_id();
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from public.business_members member
    where member.business_id = p_business_id and member.clerk_user_id = actor
  ) then
    raise exception 'Workspace unavailable' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'unread', count(*) filter (where reads.notification_id is null),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', inbox.id,
      'type', inbox.type,
      'title', inbox.title,
      'message', inbox.message,
      'href', inbox.href,
      'created_at', inbox.created_at,
      'read', reads.notification_id is not null
    ) order by inbox.created_at desc), '[]'::jsonb)
  ) into result
  from (
    select * from public.workspace_notifications
    where business_id = p_business_id
    order by created_at desc
    limit least(greatest(p_limit, 1), 50)
  ) inbox
  left join public.workspace_notification_reads reads
    on reads.notification_id = inbox.id and reads.clerk_user_id = actor;
  return result;
end;
$$;

create function public.mark_workspace_notifications_read(
  p_business_id uuid,
  p_notification_id uuid default null
) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor text := private.current_clerk_user_id();
  affected integer;
begin
  if actor is null or not exists (
    select 1 from public.business_members member
    where member.business_id = p_business_id and member.clerk_user_id = actor
  ) then
    raise exception 'Workspace unavailable' using errcode = '42501';
  end if;
  insert into public.workspace_notification_reads (notification_id, clerk_user_id)
  select notification.id, actor
  from public.workspace_notifications notification
  where notification.business_id = p_business_id
    and (p_notification_id is null or notification.id = p_notification_id)
  on conflict (notification_id, clerk_user_id)
  do update set read_at = clock_timestamp();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.workspace_notification_snapshot(uuid, integer),
  public.mark_workspace_notifications_read(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.workspace_notification_snapshot(uuid, integer),
  public.mark_workspace_notifications_read(uuid, uuid)
  to authenticated;

-- Postgres Changes requires publication membership. Disposable PostgreSQL test
-- images do not create Supabase's publication, so keep the migration portable.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workspace_notifications;
  end if;
end;
$$;

commit;
