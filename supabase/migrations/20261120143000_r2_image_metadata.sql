-- Additive image metadata. Does not copy, rewrite, or delete existing photographs.
-- Apply only with explicit authorization. Existing photo_url and reference_photo_path values stay as they are.

create table if not exists public.stored_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id),
  student_id uuid references public.people(id) on delete set null,
  attendance_id uuid references public.attendance_records(id) on delete set null,
  storage_provider text not null check (storage_provider in ('r2', 'supabase')),
  object_key text not null check (object_key !~ '\.\.' and length(object_key) between 8 and 400),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 500000),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, object_key)
);

create index if not exists stored_images_attendance_idx on public.stored_images (organization_id, attendance_id);
create index if not exists stored_images_student_idx on public.stored_images (organization_id, student_id);

alter table public.stored_images enable row level security;

drop policy if exists stored_images_read on public.stored_images;
create policy stored_images_read on public.stored_images
  for select to authenticated
  using (private.school_staff(organization_id));

comment on table public.stored_images is
  'Metadata for private image objects. The binary stays in R2 or the existing private bucket, never in this row.';
