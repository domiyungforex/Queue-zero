-- Run only against a local or staging database with synthetic rows.
-- Do not run against production. This file does not connect anywhere by itself.
--
-- After applying 20261119160000_scale_hot_path_indexes.sql, these plans should
-- show the new indexes. There is no database in this workspace, so these plans
-- have not been executed.

explain (analyze, buffers)
select id
from public.school_profiles
where organization_id = '00000000-0000-4000-8000-000000000001'
  and private.normalized_matric(matric_number) = private.normalized_matric('PHY/2026/0142');

explain (analyze, buffers)
select count(*)
from public.attendance_identity_lookups
where organization_id = '00000000-0000-4000-8000-000000000001'
  and device_hash = repeat('a', 64)
  and created_at > clock_timestamp() - interval '10 minutes';

explain (analyze, buffers)
select count(*)
from public.attendance_records
where organization_id = '00000000-0000-4000-8000-000000000001'
  and check_in_at >= date_trunc('day', clock_timestamp());
