# Image migration

Existing photographs stay where they are until an operator copies them and verifies the copy.

## Where photographs are today

| Location | What is stored |
| --- | --- |
| `attendance_records.photo_url` | A private object key, an older Supabase path, an expired signed URL, or a data URL |
| `school_profiles.reference_photo_path` | `reference/{organization}/{image}.jpg` in the private Supabase bucket |
| `attendance_records.live_photo_path` | `checks/{organization}/{class}/{image}.jpg` |
| Postgres `bytea` | Not used |
| Public URLs | Not used for new uploads |

`school_snapshot` does not return data-URL bytes. The register asks for one photograph at a time.

## Copy procedure

1. Back up the database and the Supabase `attendance-photos` bucket.
2. Set the R2 variables and confirm the bucket is private.
3. Apply `supabase/migrations/20261120143000_r2_image_metadata.sql` only after authorization. It adds metadata. It does not move or delete files.
4. For each attendance row, call `planImageMigration`. `deleteSource` is always false.
5. Upload the bytes to `targetKey`, read them back, then save the key on the attendance row and in `stored_images`.
6. Open the register as a lecturer and export the class.
7. Only after that verification, and only with a separate authorization, remove the old object.

`node scripts/migrate-images-to-r2.mjs` refuses to run unless the R2 variables and `--confirm` are present. Even then it does not connect to a database and does not delete anything. The copy itself is an operator step, not an automatic production job.

Running the planner twice for an `organizations/...` key returns `already-stored`.

## Rollback

Leave the old `photo_url` in place until the new key has been read back. If the new upload fails, the attendance row is unchanged. Deleting the new R2 object does not remove the Supabase object.
