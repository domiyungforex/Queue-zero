-- Automated Attendance Session Notifications & Delivery Tracking

create table if not exists public.attendance_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid references public.people(id) on delete set null,
  recipient_name text not null default '',
  recipient_email text,
  recipient_phone text,
  channel text not null check (channel in ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP')),
  event_type text not null check (
    event_type in (
      'SESSION_OPENED',
      'SESSION_SCHEDULED',
      'SESSION_REOPENED',
      'SESSION_RESCHEDULED',
      'SESSION_CANCELLED',
      'REMINDER_BEFORE_OPEN',
      'REMINDER_BEFORE_CLOSE'
    )
  ),
  status text not null default 'QUEUED' check (
    status in ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED_NO_CONTACT', 'CANCELLED')
  ),
  provider text not null default '',
  provider_message_id text,
  error_message text,
  attempts integer not null default 0,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_attendance_notif_session
  on public.attendance_notification_deliveries(class_session_id, status, created_at desc);

create unique index if not exists uq_attendance_notif_dedupe
  on public.attendance_notification_deliveries(class_session_id, student_id, channel, event_type)
  where student_id is not null and status <> 'CANCELLED';

alter table public.attendance_notification_deliveries enable row level security;

drop policy if exists attendance_notif_staff_all on public.attendance_notification_deliveries;
create policy attendance_notif_staff_all on public.attendance_notification_deliveries
  for all to authenticated
  using (private.school_staff(organization_id))
  with check (private.school_staff(organization_id));

drop policy if exists attendance_notif_student_read on public.attendance_notification_deliveries;
create policy attendance_notif_student_read on public.attendance_notification_deliveries
  for select to authenticated
  using (
    exists(
      select 1 from public.people p
      where p.id = student_id
        and p.clerk_user_id = private.current_clerk_user_id()
    )
  );
