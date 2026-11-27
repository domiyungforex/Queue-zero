-- TuRnMaRk Document-Based Assignments, Flexible Submissions, and Marking Audit Trail
-- Additive migration extending assignment_attachments, submission_files, and assignments.

begin;

-- 1. Extend assignments for subject-aware marking, marking instructions, and attachment limits
alter table public.assignments
  add column if not exists subject_domain text,
  add column if not exists marking_instructions text,
  add column if not exists max_attachments integer not null default 5 check (max_attachments between 1 and 20);

-- 2. Extend assignment_attachments for display titles, descriptions, roles (main / reference / lecturer-only), and ordering
alter table public.assignment_attachments
  add column if not exists display_title text,
  add column if not exists description text,
  add column if not exists attachment_role text not null default 'ASSIGNMENT_MAIN'
    check (attachment_role in ('ASSIGNMENT_MAIN', 'REFERENCE', 'LECTURER_ONLY')),
  add column if not exists sort_order integer not null default 1;

create index if not exists assignment_attachments_order_idx
  on public.assignment_attachments (assignment_id, sort_order, created_at);

-- 3. Extend submission_files for question association and server-side document processing status
alter table public.submission_files
  add column if not exists question_id uuid,
  add column if not exists extracted_text text,
  add column if not exists processing_status text not null default 'PENDING'
    check (processing_status in ('PENDING', 'PROCESSED', 'UNREADABLE', 'UNSUPPORTED'));

create index if not exists submission_files_sub_order_idx
  on public.submission_files (submission_id, page_order, created_at);

-- 4. Grading Audit Trail for lecturer overrides, AI suggestions, and grade releases
create table if not exists public.grading_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  submission_id uuid not null,
  actor_id text not null,
  action_type text not null check (action_type in (
    'AUTO_OBJECTIVE', 'AI_MARKED', 'LECTURER_OVERRIDE', 'GRADE_APPROVED', 'GRADE_RELEASED', 'RETURNED_FOR_RESUBMISSION'
  )),
  previous_score numeric(8,2),
  new_score numeric(8,2),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade,
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade
);

create index if not exists grading_audit_logs_sub_idx
  on public.grading_audit_logs (submission_id, created_at desc);

alter table public.grading_audit_logs enable row level security;

drop policy if exists grading_audit_logs_org_select on public.grading_audit_logs;
create policy grading_audit_logs_org_select
  on public.grading_audit_logs
  for select
  using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = grading_audit_logs.organization_id
        and bm.user_id = auth.uid()::text
    )
  );

drop policy if exists grading_audit_logs_org_insert on public.grading_audit_logs;
create policy grading_audit_logs_org_insert
  on public.grading_audit_logs
  for insert
  with check (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = grading_audit_logs.organization_id
        and bm.user_id = auth.uid()::text
        and bm.role in ('owner', 'admin', 'staff')
    )
  );

commit;
