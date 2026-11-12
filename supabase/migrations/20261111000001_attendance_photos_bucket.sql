begin;

-- Create attendance-photos storage bucket if it does not exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-photos',
  'attendance-photos',
  false,
  471859, -- 450 KB limit per file
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- RLS policies for attendance-photos bucket
-- Service role has full access via bypass
-- Authenticated users (lecturers) can read photos for their organization
create policy "attendance_photos_service_insert"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'attendance-photos');

create policy "attendance_photos_service_select"
  on storage.objects for select
  to service_role
  using (bucket_id = 'attendance-photos');

create policy "attendance_photos_service_delete"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'attendance-photos');

commit;
