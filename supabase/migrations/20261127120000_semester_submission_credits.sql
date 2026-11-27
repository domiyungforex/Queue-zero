-- Additive migration: Institution-configured academic semesters, per-semester 5-free submission credits
-- (shared across all courses), atomic credit consumption RPC, and credit audit transactions.

begin;

create table if not exists public.academic_semesters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  academic_session text not null check (char_length(btrim(academic_session)) between 1 and 80),
  semester_name text not null check (char_length(btrim(semester_name)) between 1 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, organization_id),
  unique (organization_id, academic_session, semester_name)
);

create index if not exists academic_semesters_active_idx
  on public.academic_semesters (organization_id, is_active, starts_at, ends_at);

create table if not exists public.student_semester_allowances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  student_id uuid not null,
  semester_id uuid not null,
  free_limit integer not null default 5 check (free_limit >= 0),
  free_used integer not null default 0 check (free_used >= 0),
  sponsored_credits integer not null default 0 check (sponsored_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, student_id, semester_id),
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade,
  foreign key (semester_id, organization_id) references public.academic_semesters(id, organization_id) on delete cascade
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  student_id uuid not null,
  semester_id uuid,
  submission_id uuid,
  request_id uuid,
  transaction_type text not null check (transaction_type in (
    'GRANT_SEMESTER', 'CONSUME_FREE', 'CONSUME_SPONSORED',
    'SPONSORED_GRANT', 'ADMIN_ADJUSTMENT', 'RELEASE_RESERVATION'
  )),
  delta integer not null,
  previous_balance integer not null,
  new_balance integer not null,
  actor_user_id text,
  reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, student_id, request_id)
);

alter table public.academic_semesters enable row level security;
alter table public.student_semester_allowances enable row level security;
alter table public.credit_transactions enable row level security;

grant select, insert, update on public.academic_semesters, public.student_semester_allowances, public.credit_transactions to authenticated;
grant all on public.academic_semesters, public.student_semester_allowances, public.credit_transactions to service_role;

create policy semesters_read on public.academic_semesters for select to authenticated
  using (exists(select 1 from public.business_members m where m.business_id = organization_id and m.clerk_user_id = private.current_clerk_user_id()));
create policy semesters_manage on public.academic_semesters for all to authenticated
  using (private.school_manager(organization_id))
  with check (private.school_manager(organization_id));

create policy semester_allowances_read on public.student_semester_allowances for select to authenticated
  using (private.school_staff(organization_id) or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id()));

create policy credit_tx_read on public.credit_transactions for select to authenticated
  using (private.school_manager(organization_id) or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id()));

-- Atomic semester credit consumption (prevents concurrent overdraw and duplicate request consumption)
create or replace function public.consume_student_submission_credit(
  p_organization_id uuid,
  p_student_id uuid,
  p_semester_id uuid,
  p_submission_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  alw public.student_semester_allowances%rowtype;
  default_limit integer;
  prev_rem integer;
begin
  -- Idempotency check: if this request_id already consumed a credit, return success without consuming again
  if exists(
    select 1 from public.credit_transactions
    where organization_id = p_organization_id and student_id = p_student_id and request_id = p_request_id
  ) then
    return jsonb_build_object('ok', true, 'source', 'REPLAY');
  end if;

  select coalesce(free_allowance_limit, 5) into default_limit
  from public.submission_fee_configs where organization_id = p_organization_id;
  default_limit := coalesce(default_limit, 5);

  insert into public.student_semester_allowances(organization_id, student_id, semester_id, free_limit, free_used, sponsored_credits)
  values (p_organization_id, p_student_id, p_semester_id, default_limit, 0, 0)
  on conflict (organization_id, student_id, semester_id) do nothing;

  select * into alw
  from public.student_semester_allowances
  where organization_id = p_organization_id and student_id = p_student_id and semester_id = p_semester_id
  for update;

  if alw.free_used < alw.free_limit then
    prev_rem := alw.free_limit - alw.free_used;
    update public.student_semester_allowances
      set free_used = free_used + 1, updated_at = clock_timestamp()
      where id = alw.id;
    insert into public.credit_transactions(
      organization_id, student_id, semester_id, submission_id, request_id,
      transaction_type, delta, previous_balance, new_balance, reason
    ) values (
      p_organization_id, p_student_id, p_semester_id, p_submission_id, p_request_id,
      'CONSUME_FREE', -1, prev_rem, prev_rem - 1, 'Assignment submission'
    );
    return jsonb_build_object('ok', true, 'source', 'FREE_ALLOWANCE', 'remaining_free', prev_rem - 1);
  elsif alw.sponsored_credits > 0 then
    prev_rem := alw.sponsored_credits;
    update public.student_semester_allowances
      set sponsored_credits = sponsored_credits - 1, updated_at = clock_timestamp()
      where id = alw.id;
    insert into public.credit_transactions(
      organization_id, student_id, semester_id, submission_id, request_id,
      transaction_type, delta, previous_balance, new_balance, reason
    ) values (
      p_organization_id, p_student_id, p_semester_id, p_submission_id, p_request_id,
      'CONSUME_SPONSORED', -1, prev_rem, prev_rem - 1, 'Sponsored submission credit'
    );
    return jsonb_build_object('ok', true, 'source', 'SPONSORED_CREDIT', 'remaining_free', 0);
  end if;

  return jsonb_build_object('ok', false, 'source', 'PAYMENT_REQUIRED', 'remaining_free', 0);
end $$;

revoke all on function public.consume_student_submission_credit(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_student_submission_credit(uuid, uuid, uuid, uuid, uuid) to service_role;

commit;
