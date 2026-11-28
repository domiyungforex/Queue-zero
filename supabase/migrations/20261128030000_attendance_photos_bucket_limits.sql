-- 20261128030000_attendance_photos_bucket_limits
--
-- Root cause of "Private storage unavailable." on every student/lecturer
-- file upload: lib/storage/store-image.ts stores ALL private files
-- (assignment attachments, ingest sources, class photos, registration
-- photos) in the Supabase bucket "attendance-photos" whenever Cloudflare
-- R2 is not configured. That bucket was created for attendance selfies
-- only, with file_size_limit = 471859 bytes (~460 KB) and
-- allowed_mime_types = {image/jpeg, image/png, image/webp}. The academic
-- upload flow accepts PDFs, DOCX, TXT, ZIP and files up to 25 MB, so the
-- bucket rejected nearly every real upload and the API surfaced its
-- generic 503 "Private storage unavailable."
--
-- The bucket is private and only reachable through server-side
-- service-role routes; the application already validates file type and
-- size itself (validateUniversalFile), so the bucket-level photo
-- restrictions are removed and the limit is raised to 50 MB (the app's
-- own maximum). A service_role UPDATE policy is also added because the
-- storage helper uploads with upsert: true, which requires UPDATE.
--
-- Already applied to production on 2026-11-28 via the Supabase
-- Management API (recorded in supabase_migrations.schema_migrations);
-- this file keeps the repository authoritative.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = null
where id = 'attendance-photos';

drop policy if exists attendance_photos_service_update on storage.objects;
create policy attendance_photos_service_update on storage.objects
  for update to service_role
  using (bucket_id = 'attendance-photos')
  with check (bucket_id = 'attendance-photos');
