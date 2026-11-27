-- Additive migration: Assignment distribution, guest links, 5-free allowance, Paystack submission payments,
-- configurable lecturer revenue share, 10% referral commission, immutable financial ledger, and withdrawals.

begin;

-- 1. Extend assignments with distribution & fee category
alter table public.assignments
  add column if not exists audience_mode text not null default 'ALL_ENROLLED'
    check (audience_mode in ('ALL_ENROLLED', 'ATTENDANCE_SESSION', 'DEPARTMENT_LEVEL', 'INDIVIDUAL', 'CUSTOM')),
  add column if not exists attendance_session_id uuid,
  add column if not exists fee_category text not null default 'STANDARD'
    check (fee_category in ('STANDARD', 'EXTENDED', 'SPECIALISED')),
  add column if not exists max_files integer not null default 5 check (max_files between 1 and 50);

-- 2. Assignment Recipients & Notification Delivery Tracking
create table if not exists public.assignment_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  student_id uuid not null,
  channel text not null default 'EMAIL' check (channel in ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP')),
  delivery_status text not null default 'QUEUED' check (delivery_status in ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED')),
  provider_message_id text,
  error_message text,
  accessed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade,
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

create index if not exists assignment_recipients_idx on public.assignment_recipients (assignment_id, delivery_status);

-- 3. Configurable Submission Fee & Revenue-Share Config (Admin-configurable, no hardcoded frontend prices)
create table if not exists public.submission_fee_configs (
  organization_id uuid primary key references public.businesses(id) on delete cascade,
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  free_allowance_limit integer not null default 5 check (free_allowance_limit between 0 and 100),
  standard_fee_minor integer not null default 20000 check (standard_fee_minor >= 0),
  extended_fee_minor integer not null default 30000 check (extended_fee_minor >= 0),
  specialised_fee_minor integer not null default 50000 check (specialised_fee_minor >= 0),
  lecturer_share_bps integer not null default 7000 check (lecturer_share_bps between 0 and 10000),
  referral_commission_bps integer not null default 1000 check (referral_commission_bps between 0 and 5000),
  min_withdrawal_minor integer not null default 500000 check (min_withdrawal_minor >= 0),
  updated_by text,
  updated_at timestamptz not null default now()
);

-- 4. Student Submission Allowance (keyed to stable institutional student_id)
create table if not exists public.student_submission_allowances (
  organization_id uuid not null references public.businesses(id) on delete cascade,
  student_id uuid not null,
  free_used integer not null default 0 check (free_used >= 0),
  sponsored_credits integer not null default 0 check (sponsored_credits >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, student_id),
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

-- 5. Assignment Submission Payments (Paystack NGN transactions)
create table if not exists public.assignment_payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  student_id uuid not null,
  fee_category text not null check (fee_category in ('STANDARD', 'EXTENDED', 'SPECIALISED')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  provider text not null default 'paystack',
  provider_transaction_id text,
  consumed_submission_id uuid,
  verified_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade,
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

create index if not exists assignment_payments_student_idx on public.assignment_payments (organization_id, student_id, assignment_id, status);

-- 6. Referral Codes & Attributions
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  clerk_user_id text not null,
  code text not null unique check (code ~ '^[A-Z0-9_-]{4,32}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, clerk_user_id)
);

create table if not exists public.referral_attributions (
  organization_id uuid not null references public.businesses(id) on delete cascade,
  student_id uuid not null,
  referrer_user_id text not null,
  referral_code text not null,
  attributed_at timestamptz not null default now(),
  primary key (organization_id, student_id),
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

-- 7. Immutable Financial Ledger (minor units, integer arithmetic)
create table if not exists public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid,
  submission_id uuid,
  payment_reference text not null,
  beneficiary_user_id text,
  transaction_type text not null check (transaction_type in (
    'STUDENT_PAYMENT', 'PLATFORM_ALLOCATION', 'LECTURER_COMMISSION',
    'REFERRAL_COMMISSION', 'REFUND', 'REVERSAL', 'WITHDRAWAL', 'ADJUSTMENT'
  )),
  amount_minor bigint not null,
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'CONFIRMED' check (status in ('PENDING', 'CONFIRMED', 'REVERSED', 'FAILED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_beneficiary_idx on public.financial_ledger (organization_id, beneficiary_user_id, transaction_type);
create index if not exists financial_ledger_ref_idx on public.financial_ledger (payment_reference);

-- 8. Payout Bank Accounts & Withdrawal Requests
create table if not exists public.payout_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  clerk_user_id text not null,
  bank_name text not null,
  bank_code text not null,
  account_number_last4 text not null check (account_number_last4 ~ '^\d{4}$'),
  account_name text not null,
  recipient_code text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, clerk_user_id, bank_code, account_number_last4)
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  clerk_user_id text not null,
  bank_account_id uuid not null references public.payout_bank_accounts(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'PAID', 'FAILED', 'REJECTED')),
  provider_transfer_code text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9. RLS & Grants
do $$
declare
  t text;
begin
  foreach t in array array[
    'assignment_recipients', 'submission_fee_configs', 'student_submission_allowances',
    'assignment_payments', 'referral_codes', 'referral_attributions',
    'financial_ledger', 'payout_bank_accounts', 'withdrawal_requests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create policy recipients_staff_only on public.assignment_recipients for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy fee_configs_read on public.submission_fee_configs for select to authenticated
  using (exists(select 1 from public.business_members m where m.business_id = organization_id and m.clerk_user_id = private.current_clerk_user_id()));
create policy fee_configs_admin on public.submission_fee_configs for all to authenticated
  using (private.school_manager(organization_id))
  with check (private.school_manager(organization_id));

create policy allowances_read on public.student_submission_allowances for select to authenticated
  using (private.school_staff(organization_id) or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id()));

create policy payments_read on public.assignment_payments for select to authenticated
  using (private.school_staff(organization_id) or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id()));

create policy referral_codes_own on public.referral_codes for all to authenticated
  using (clerk_user_id = private.current_clerk_user_id() or private.school_manager(organization_id))
  with check (clerk_user_id = private.current_clerk_user_id() or private.school_manager(organization_id));

create policy referral_attributions_read on public.referral_attributions for select to authenticated
  using (referrer_user_id = private.current_clerk_user_id() or private.school_manager(organization_id));

create policy financial_ledger_read on public.financial_ledger for select to authenticated
  using (beneficiary_user_id = private.current_clerk_user_id() or private.school_manager(organization_id));

create policy bank_accounts_own on public.payout_bank_accounts for all to authenticated
  using (clerk_user_id = private.current_clerk_user_id() or private.school_manager(organization_id))
  with check (clerk_user_id = private.current_clerk_user_id());

create policy withdrawals_own on public.withdrawal_requests for all to authenticated
  using (clerk_user_id = private.current_clerk_user_id() or private.school_manager(organization_id))
  with check (clerk_user_id = private.current_clerk_user_id() or private.school_manager(organization_id));

commit;
