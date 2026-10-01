-- Application schema. All writes are reserved for trusted, authorized server/RPC
-- operations introduced in later tasks. UUID identifiers are not authorization.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create type public.business_role as enum ('owner', 'admin', 'staff');
create type public.subscription_plan as enum ('FREE', 'STARTER', 'BUSINESS');
create type public.queue_status as enum ('open', 'paused', 'closed');
create type public.ticket_status as enum ('waiting', 'serving', 'completed', 'no_show', 'cancelled');
create type public.ticket_event_type as enum ('joined', 'called', 'recalled', 'completed', 'no_show', 'cancelled');
create type public.ticket_actor_type as enum ('customer', 'staff', 'system');
create type public.notification_channel as enum ('web_push', 'sms', 'whatsapp');
create type public.notification_type as enum ('almost_your_turn', 'your_turn', 'queue_paused');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');
create type public.subscription_status as enum ('pending', 'active', 'past_due', 'cancelled', 'expired');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  slug text not null unique check (char_length(slug) between 3 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_user_id text not null check (char_length(btrim(owner_user_id)) between 1 and 255),
  industry text not null check (char_length(btrim(industry)) between 1 and 100),
  timezone text not null default 'UTC',
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  logo_url text check (char_length(logo_url) <= 2048 and logo_url ~ '^https://'),
  subscription_tier public.subscription_plan not null default 'FREE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  clerk_user_id text not null check (char_length(btrim(clerk_user_id)) between 1 and 255),
  role public.business_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (business_id, clerk_user_id),
  unique (id, business_id)
);
create unique index business_members_one_owner on public.business_members (business_id) where role = 'owner';
create index business_members_user_lookup on public.business_members (clerk_user_id, business_id);
-- Allows business + owner membership to be created together in one transaction.
alter table public.businesses add constraint businesses_owner_membership_fk
  foreign key (id, owner_user_id) references public.business_members (business_id, clerk_user_id)
  deferrable initially deferred;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  address text not null check (char_length(btrim(address)) between 1 and 500),
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create index locations_business_lookup on public.locations (business_id);

create table public.queues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  location_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  slug text not null unique check (char_length(slug) between 3 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 2000),
  status public.queue_status not null default 'open',
  average_service_seconds integer not null default 300 check (average_service_seconds between 1 and 86400),
  warning_threshold integer not null default 3 check (warning_threshold between 0 and 100),
  allow_phone boolean not null default false,
  require_phone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not require_phone or allow_phone),
  unique (id, business_id),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete restrict
);
create index queues_business_lookup on public.queues (business_id);
create index queues_location_lookup on public.queues (location_id, business_id);

-- Required to implement "staff operate assigned queues", rather than silently
-- giving every staff member access to all customer data in their business.
create table public.queue_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  queue_id uuid not null,
  business_member_id uuid not null,
  created_at timestamptz not null default now(),
  unique (queue_id, business_member_id),
  foreign key (queue_id, business_id) references public.queues (id, business_id) on delete restrict,
  foreign key (business_member_id, business_id) references public.business_members (id, business_id) on delete restrict
);
create index queue_assignments_member_lookup on public.queue_staff_assignments (business_member_id, queue_id);
create index queue_assignments_business_lookup on public.queue_staff_assignments (business_id);

create table public.queue_daily_counters (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete restrict,
  service_date date not null,
  last_number integer not null default 0 check (last_number >= 0),
  unique (queue_id, service_date)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete restrict,
  public_token uuid not null unique default gen_random_uuid(),
  -- Numbering resets in the location's timezone, not at UTC midnight.
  service_date date not null,
  sequence_number integer not null check (sequence_number > 0),
  display_number text not null check (display_number ~ '^[A-Z]+[0-9]{3,}$' and char_length(display_number) <= 20),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  phone text check (char_length(btrim(phone)) between 6 and 32),
  status public.ticket_status not null default 'waiting',
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show_at timestamptz,
  estimated_wait_seconds integer not null default 0 check (estimated_wait_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_id, service_date, sequence_number),
  unique (id, queue_id),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check ((status = 'no_show') = (no_show_at is not null)),
  check (status not in ('serving', 'completed') or called_at is not null),
  check (status not in ('waiting', 'cancelled') or called_at is null),
  check (called_at >= joined_at),
  check (completed_at >= called_at),
  check (cancelled_at >= joined_at),
  check (no_show_at >= coalesce(called_at, joined_at))
);
-- A single active counter is the Week-1 invariant. Later capacity support must
-- replace this deliberately, not disable the constraint to fix an operation.
create unique index tickets_one_serving_per_queue on public.tickets (queue_id) where status = 'serving';
create index tickets_waiting_order on public.tickets (queue_id, joined_at, id) where status = 'waiting';
create index tickets_queue_joined_lookup on public.tickets (queue_id, joined_at);
create index tickets_completed_lookup on public.tickets (queue_id, completed_at desc) where status = 'completed';

create table public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  queue_id uuid not null,
  type public.ticket_event_type not null,
  actor_type public.ticket_actor_type not null,
  actor_id text check (char_length(actor_id) <= 255),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (ticket_id, queue_id) references public.tickets (id, queue_id) on delete restrict
);
create index ticket_events_ticket_history on public.ticket_events (ticket_id, created_at);
create index ticket_events_queue_history on public.ticket_events (queue_id, created_at);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete restrict,
  clerk_user_id text check (char_length(btrim(clerk_user_id)) between 1 and 255),
  endpoint text not null unique check (char_length(endpoint) <= 4096 and endpoint ~ '^https://'),
  p256dh text not null check (char_length(p256dh) between 1 and 512),
  auth text not null check (char_length(auth) between 1 and 512),
  created_at timestamptz not null default now(),
  check (num_nonnulls(ticket_id, clerk_user_id) = 1)
);
create index push_subscriptions_ticket_lookup on public.push_subscriptions (ticket_id) where ticket_id is not null;
create index push_subscriptions_user_lookup on public.push_subscriptions (clerk_user_id) where clerk_user_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  channel public.notification_channel not null,
  type public.notification_type not null,
  status public.notification_status not null default 'pending',
  -- Future notification events supply a stable key; retries reuse the same row.
  deduplication_key text not null check (char_length(deduplication_key) between 1 and 255),
  provider_reference text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (channel, deduplication_key),
  check ((status = 'sent') = (sent_at is not null))
);
create index notifications_ticket_lookup on public.notifications (ticket_id, created_at);
create index notifications_pending_lookup on public.notifications (created_at) where status = 'pending';

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_customer_code text,
  provider_subscription_code text,
  plan public.subscription_plan not null default 'FREE',
  status public.subscription_status not null default 'pending',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_code)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack', 'clerk')),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index webhook_events_unprocessed_lookup on public.webhook_events (created_at) where processed_at is null;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid IANA timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.enforce_business_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  affected_ids uuid[];
  affected_id uuid;
begin
  if tg_table_name = 'businesses' then
    if tg_op = 'DELETE' then affected_ids := array[old.id];
    else affected_ids := array[new.id]; end if;
  else
    if tg_op = 'INSERT' then affected_ids := array[new.business_id];
    elsif tg_op = 'DELETE' then affected_ids := array[old.business_id];
    else affected_ids := array[old.business_id, new.business_id]; end if;
  end if;
  foreach affected_id in array affected_ids loop
    if exists (
      select 1 from public.businesses b
      where b.id = affected_id and not exists (
        select 1 from public.business_members m
        where m.business_id = b.id and m.clerk_user_id = b.owner_user_id and m.role = 'owner'
      )
    ) then
      raise exception 'Business must have its matching owner membership' using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;

create function private.reject_ticket_event_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Ticket events are append-only' using errcode = '55000';
end;
$$;

create trigger businesses_updated_at before update on public.businesses for each row execute function private.set_updated_at();
create trigger locations_updated_at before update on public.locations for each row execute function private.set_updated_at();
create trigger queues_updated_at before update on public.queues for each row execute function private.set_updated_at();
create trigger tickets_updated_at before update on public.tickets for each row execute function private.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function private.set_updated_at();
create trigger businesses_timezone before insert or update of timezone on public.businesses for each row execute function private.validate_timezone();
create trigger locations_timezone before insert or update of timezone on public.locations for each row execute function private.validate_timezone();
create constraint trigger businesses_owner_consistency after insert or update on public.businesses
  deferrable initially deferred for each row execute function private.enforce_business_owner();
create constraint trigger members_owner_consistency after insert or update or delete on public.business_members
  deferrable initially deferred for each row execute function private.enforce_business_owner();
create trigger ticket_events_immutable before update or delete on public.ticket_events for each row execute function private.reject_ticket_event_mutation();

revoke all on all functions in schema private from public, anon, authenticated;


-- Enable RLS and remove Supabase default client grants before this migration commits.
alter table public.businesses enable row level security;
alter table public.businesses force row level security;
revoke all on table public.businesses from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.businesses to service_role;
alter table public.business_members enable row level security;
alter table public.business_members force row level security;
revoke all on table public.business_members from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.business_members to service_role;
alter table public.locations enable row level security;
alter table public.locations force row level security;
revoke all on table public.locations from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.locations to service_role;
alter table public.queues enable row level security;
alter table public.queues force row level security;
revoke all on table public.queues from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.queues to service_role;
alter table public.queue_staff_assignments enable row level security;
alter table public.queue_staff_assignments force row level security;
revoke all on table public.queue_staff_assignments from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.queue_staff_assignments to service_role;
alter table public.queue_daily_counters enable row level security;
alter table public.queue_daily_counters force row level security;
revoke all on table public.queue_daily_counters from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.queue_daily_counters to service_role;
alter table public.tickets enable row level security;
alter table public.tickets force row level security;
revoke all on table public.tickets from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.tickets to service_role;
alter table public.ticket_events enable row level security;
alter table public.ticket_events force row level security;
revoke all on table public.ticket_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.ticket_events to service_role;
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
revoke all on table public.notifications from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.notifications to service_role;
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
revoke all on table public.subscriptions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.subscriptions to service_role;
alter table public.webhook_events enable row level security;
alter table public.webhook_events force row level security;
revoke all on table public.webhook_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.webhook_events to service_role;

revoke create on schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

commit;
