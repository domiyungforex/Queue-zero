-- Additive migration: Student classification verification & Smart Assignment ingestion jobs
-- Safe for existing data. No destructive changes.

begin;

alter table public.school_profiles
  add column if not exists classification_status text not null default 'VERIFIED'
    check (classification_status in ('VERIFIED', 'PENDING_REVIEW', 'UNMATCHED')),
  add column if not exists unverified_faculty_text text,
  add column if not exists unverified_department_text text,
  add column if not exists classification_audit jsonb not null default '[]'::jsonb;

create index if not exists school_profiles_classification_idx
  on public.school_profiles (organization_id, classification_status);

create table if not exists public.assignment_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  created_by text not null,
  source_method text not null check (source_method in ('DOCUMENT', 'PHOTO', 'DESCRIPTION')),
  original_file_path text,
  status text not null default 'COMPLETED' check (status in ('UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW')),
  extracted_json jsonb not null default '{}'::jsonb,
  confidence_notes jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assignment_ingestion_jobs enable row level security;
grant select, insert, update on public.assignment_ingestion_jobs to authenticated;
grant all on public.assignment_ingestion_jobs to service_role;

drop policy if exists ingestion_jobs_staff_only on public.assignment_ingestion_jobs;
create policy ingestion_jobs_staff_only on public.assignment_ingestion_jobs for all to authenticated
  using (private.school_staff(organization_id))
  with check (private.school_staff(organization_id));

commit;
