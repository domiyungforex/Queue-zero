-- Additive migration: DB-backed pricing engine, multi-provider billing, team RBAC roles, public team profiles
-- Safe for existing data. No destructive changes.

-- 1. Expand business_role enum outside transaction block
alter type public.business_role add value if not exists 'manager';
alter type public.business_role add value if not exists 'viewer';

begin;

-- 2. DB-backed Pricing Engine
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  interval text not null check (interval in ('monthly', 'annual')),
  amount_minor integer not null check (amount_minor >= 0),
  provider text not null default 'paystack' check (provider in ('paystack', 'stripe')),
  provider_price_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, currency, interval, provider)
);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z0-9_]+$'),
  limit_value integer,
  description text,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.plan_entitlements enable row level security;

drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select to anon, authenticated using (is_active = true);

drop policy if exists plan_prices_public_read on public.plan_prices;
create policy plan_prices_public_read on public.plan_prices for select to anon, authenticated using (is_active = true);

drop policy if exists plan_entitlements_public_read on public.plan_entitlements;
create policy plan_entitlements_public_read on public.plan_entitlements for select to anon, authenticated using (true);

grant select on public.plans, public.plan_prices, public.plan_entitlements to anon, authenticated;
grant all on public.plans, public.plan_prices, public.plan_entitlements to service_role;

-- Seed default plans (idempotent)
insert into public.plans (code, name, description, is_active, is_featured, sort_order) values
  ('FREE', 'Free', 'Free for a single small operation.', true, false, 1),
  ('STARTER', 'Starter', 'Affordable monthly plan for small businesses and teams.', true, true, 2),
  ('GROWTH', 'Growth', 'Higher capacity for growing businesses and clinics.', true, false, 3),
  ('PROFESSIONAL', 'Professional', 'More queues, locations and team members for larger organizations.', true, false, 4),
  ('EDUCATION', 'Education', 'Institutional pricing for schools and universities.', true, false, 5),
  ('EVENTS', 'Events', 'Per-event pricing for conference and summit organizers.', true, false, 6),
  ('ENTERPRISE', 'Enterprise', 'Custom quote for large institutions.', true, false, 7)
on conflict (code) do nothing;

-- Seed default NGN monthly & annual prices (amount in kobo = NGN * 100)
insert into public.plan_prices (plan_id, currency, interval, amount_minor, provider)
select id, 'NGN', 'monthly',
  case code
    when 'FREE' then 0
    when 'STARTER' then 750000
    when 'GROWTH' then 2000000
    when 'PROFESSIONAL' then 4500000
    when 'EDUCATION' then 3500000
    when 'EVENTS' then 1500000
    when 'ENTERPRISE' then 0
  end,
  'paystack'
from public.plans
where code in ('FREE','STARTER','GROWTH','PROFESSIONAL','EDUCATION','EVENTS','ENTERPRISE')
on conflict (plan_id, currency, interval, provider) do nothing;

insert into public.plan_prices (plan_id, currency, interval, amount_minor, provider)
select id, 'USD', 'monthly',
  case code
    when 'FREE' then 0
    when 'STARTER' then 900
    when 'GROWTH' then 2500
    when 'PROFESSIONAL' then 5900
    when 'EDUCATION' then 4500
    when 'EVENTS' then 1900
    when 'ENTERPRISE' then 0
  end,
  'stripe'
from public.plans
where code in ('FREE','STARTER','GROWTH','PROFESSIONAL','EDUCATION','EVENTS','ENTERPRISE')
on conflict (plan_id, currency, interval, provider) do nothing;

-- Seed default entitlements
insert into public.plan_entitlements (plan_id, feature_key, limit_value, description)
select p.id, e.feature_key, e.limit_value, e.description
from public.plans p
cross join lateral (
  values
    ('max_queues', case p.code when 'FREE' then 1 when 'STARTER' then 3 when 'GROWTH' then 10 when 'PROFESSIONAL' then 25 when 'EDUCATION' then 15 when 'EVENTS' then 5 else null end, 'Active queues limit'),
    ('max_locations', case p.code when 'FREE' then 1 when 'STARTER' then 2 when 'GROWTH' then 5 when 'PROFESSIONAL' then 10 when 'EDUCATION' then 8 when 'EVENTS' then 3 else null end, 'Physical locations limit'),
    ('max_staff', case p.code when 'FREE' then 2 when 'STARTER' then 5 when 'GROWTH' then 15 when 'PROFESSIONAL' then 40 when 'EDUCATION' then 30 when 'EVENTS' then 10 else null end, 'Team members limit'),
    ('max_monthly_activity', case p.code when 'FREE' then 100 when 'STARTER' then 1000 when 'GROWTH' then 5000 when 'PROFESSIONAL' then 20000 when 'EDUCATION' then 10000 when 'EVENTS' then 2000 else null end, 'Monthly tickets & check-ins'),
    ('booking_enabled', case p.code when 'FREE' then 0 else 1 end, 'Scheduled bookings & virtual queue'),
    ('analytics_enabled', case p.code when 'FREE' then 0 else 1 end, 'Operational analytics & exports')
) as e(feature_key, limit_value, description)
on conflict (plan_id, feature_key) do nothing;

-- 3. Multi-provider billing columns
alter table public.billing_checkouts
  add column if not exists provider text not null default 'paystack' check (provider in ('paystack', 'stripe'));

alter table public.subscriptions
  add column if not exists provider text not null default 'paystack' check (provider in ('paystack', 'stripe'));

-- 4. Public Team Profiles table (only real, DB-backed profiles)
create table if not exists public.team_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  role_title text not null check (char_length(btrim(role_title)) between 1 and 120),
  bio text check (char_length(bio) <= 600),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.team_profiles enable row level security;
drop policy if exists team_profiles_public_read on public.team_profiles;
create policy team_profiles_public_read on public.team_profiles for select to anon, authenticated using (is_published = true);
grant select on public.team_profiles to anon, authenticated;
grant all on public.team_profiles to service_role;

-- 5. Expand save_staff to support manager and viewer roles cleanly
create or replace function public.save_staff(p_business_id uuid,p_user_id text,p_role public.business_role,p_queue_ids uuid[],p_remove boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor_role public.business_role:=private.business_role_for(p_business_id); member_id uuid; old_role public.business_role;
begin
 if actor_role is null or actor_role not in ('owner','admin') then raise exception 'Manager required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id)>255 or p_role is null or p_role not in ('admin','manager','staff','viewer') or p_queue_ids is null or cardinality(p_queue_ids)>100 or p_remove is null then raise exception 'Invalid member' using errcode='22023'; end if;
 if p_user_id=private.current_clerk_user_id() then raise exception 'Cannot edit your own membership' using errcode='42501'; end if;
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
