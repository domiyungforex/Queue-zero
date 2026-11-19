-- Hot-path indexes for attendance lookup and institution dashboards.
-- Additive only. Does not rewrite rows, partition tables, or change functions.
-- Do not apply to production without explicit authorization.

begin;

create index if not exists school_profiles_org_matric_fn
  on public.school_profiles (organization_id, (private.normalized_matric(matric_number)));

create index if not exists attendance_identity_lookups_device_window
  on public.attendance_identity_lookups (organization_id, device_hash, created_at desc);

create index if not exists attendance_records_org_check_in
  on public.attendance_records (organization_id, check_in_at desc)
  where check_in_at is not null;

commit;
