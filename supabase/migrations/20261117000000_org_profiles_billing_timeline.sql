-- Additive: expanded organization types, profile fields, billing plans, operations timeline
-- Safe for existing data. No destructive changes.

-- Expand organization types
alter type public.organization_type add value if not exists 'BUSINESS';
alter type public.organization_type add value if not exists 'SCHOOL';
alter type public.organization_type add value if not exists 'UNIVERSITY';
alter type public.organization_type add value if not exists 'HOSPITAL';
alter type public.organization_type add value if not exists 'CLINIC';
alter type public.organization_type add value if not exists 'GOVERNMENT';
alter type public.organization_type add value if not exists 'CORPORATE';
alter type public.organization_type add value if not exists 'EVENT_ORGANIZER';
alter type public.organization_type add value if not exists 'CONFERENCE_ORGANIZER';
alter type public.organization_type add value if not exists 'NONPROFIT';
alter type public.organization_type add value if not exists 'OTHER';

-- Expand subscription plans
alter type public.subscription_plan add value if not exists 'GROWTH';
alter type public.subscription_plan add value if not exists 'PROFESSIONAL';
alter type public.subscription_plan add value if not exists 'EDUCATION';
alter type public.subscription_plan add value if not exists 'EVENTS';
alter type public.subscription_plan add value if not exists 'ENTERPRISE';

-- Organization profile fields
alter table public.businesses
  add column if not exists description text,
  add column if not exists cover_url text,
  add column if not exists website text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists social_links jsonb default '{}'::jsonb,
  add column if not exists operating_hours jsonb default '{}'::jsonb;

comment on column public.businesses.cover_url is 'Optional cover image URL (https).';
comment on column public.businesses.social_links is 'Organization social links as JSON object.';

-- Physical operations timeline (auditable event history)
create table if not exists public.operations_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id),
  subject_type text not null check (subject_type in ('TICKET','BOOKING','ATTENDANCE','SESSION')),
  subject_id uuid not null,
  event_type text not null,
  actor_type text not null default 'system',
  actor_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists operations_events_org_subject on public.operations_events (organization_id, subject_type, subject_id, created_at desc);
create index if not exists operations_events_org_time on public.operations_events (organization_id, created_at desc);

alter table public.operations_events enable row level security;

-- Session type for universal attendance (additive)
alter table public.class_sessions
  add column if not exists session_type text default 'CLASS'
    check (session_type in ('CLASS','MEETING','EXECUTIVE_MEETING','WORKSHOP','CONFERENCE','SUMMIT','TRAINING','GENERAL_EVENT'));

comment on column public.class_sessions.session_type is 'Reusable session category. CLASS is the school default; other types support corporate, event, and general attendance.';

-- Ensure booking settings table exists and has defaults (already created by prior migration)
-- No changes needed; get_effective_booking_settings already falls back to enabled=true.
