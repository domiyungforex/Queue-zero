# Image security

- R2 credentials are read from server environment variables only.
- The bucket is private. Student photographs are not given a public base URL.
- Upload validates the data-URL type and the file's JPEG, PNG or WebP magic bytes. A renamed text file is rejected. Files under 12 KB or over 450 KB are rejected.
- Attendance, profile and live-check photographs use different key prefixes.
- The staff image route loads the attendance row with the lecturer's database session, then refuses a key whose organization id does not match that membership.
- Signed download URLs last five minutes and are not written to Postgres.
- CSV exports say "On file" or "—". They do not contain an image URL.
- A failed photograph upload does not by itself mark attendance as recorded. Registration is not saved if the profile photograph cannot be stored, and the new object is removed if the profile insert fails.
- Row Level Security is unchanged. `stored_images` adds a staff-only select policy and no authenticated insert policy.
