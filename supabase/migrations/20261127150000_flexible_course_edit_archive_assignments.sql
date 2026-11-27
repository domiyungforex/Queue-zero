-- Flexible Course Entry, Assignment Editing, Version History, Archive & Safe Delete

alter table public.assignments
  alter column course_id drop not null;

alter table public.assignments
  add column if not exists manual_course_code text,
  add column if not exists manual_course_name text,
  add column if not exists manual_department text,
  add column if not exists manual_faculty text,
  add column if not exists manual_level text,
  add column if not exists course_classification_status text not null default 'CATALOG'
    check (course_classification_status in ('CATALOG', 'MANUAL_UNVERIFIED', 'VERIFIED')),
  add column if not exists edited_by text,
  add column if not exists edited_at timestamptz,
  add column if not exists audit_history jsonb not null default '[]'::jsonb,
  add column if not exists archived_at timestamptz;

create table if not exists public.assignment_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  version_number integer not null,
  edited_by text,
  change_summary text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (assignment_id, version_number)
);

create index if not exists idx_assignment_versions_assignment
  on public.assignment_versions(assignment_id, version_number desc);

alter table public.assignment_versions enable row level security;

create or replace function private.assignment_staff_access(p_course_id uuid, p_org_id uuid, p_created_by text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_course_id is not null and private.school_course_access(p_course_id))
    or (
      p_course_id is null
      and (
        private.school_staff(p_org_id)
        or (p_created_by is not null and p_created_by = private.current_clerk_user_id())
      )
    );
$$;

drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments for select to authenticated
  using (
    deleted_at is null and (
      private.assignment_staff_access(course_id, organization_id, created_by)
      or (status in ('PUBLISHED', 'CLOSED', 'ARCHIVED') and exists(
        select 1 from public.people p
        where p.organization_id = assignments.organization_id
          and p.clerk_user_id = private.current_clerk_user_id()
      ))
    )
  );

drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments for all to authenticated
  using (private.assignment_staff_access(course_id, organization_id, created_by))
  with check (private.assignment_staff_access(course_id, organization_id, created_by));

drop policy if exists questions_read on public.assignment_questions;
create policy questions_read on public.assignment_questions for select to authenticated
  using (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and a.deleted_at is null
      and (
        private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
        or a.status in ('PUBLISHED', 'CLOSED')
      )
  ));

drop policy if exists questions_write on public.assignment_questions;
create policy questions_write on public.assignment_questions for all to authenticated
  using (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ))
  with check (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ));

drop policy if exists answer_keys_staff_only on public.answer_keys;
create policy answer_keys_staff_only on public.answer_keys for all to authenticated
  using (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ))
  with check (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ));

drop policy if exists rubrics_staff_only on public.marking_rubrics;
create policy rubrics_staff_only on public.marking_rubrics for all to authenticated
  using (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ))
  with check (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ));

drop policy if exists attachments_write on public.assignment_attachments;
create policy attachments_write on public.assignment_attachments for all to authenticated
  using (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ))
  with check (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ));

drop policy if exists assignment_versions_staff_only on public.assignment_versions;
create policy assignment_versions_staff_only on public.assignment_versions for all to authenticated
  using (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ))
  with check (exists(
    select 1 from public.assignments a
    where a.id = assignment_id
      and private.assignment_staff_access(a.course_id, a.organization_id, a.created_by)
  ));
