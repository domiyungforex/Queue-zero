-- 20261128020000_service_role_table_grants
--
-- Root cause of "Matriculation number not found in this institution" for
-- every guest student (and of silent failures in other public flows):
-- the school/attendance-domain tables created by
-- 20261004015405_school_attendance.sql (school_profiles, people,
-- attendance_records, course_students, courses, departments, ...) never
-- received grants for the service_role. Server actions that read them
-- through the service-role ("join") client -- guest assignment
-- verification, attendance check-in fallbacks, public joins -- therefore
-- got permission-denied from PostgREST, and because those call sites
-- discard the error field, every lookup looked like "no rows" and every
-- registered student was reported as not found.
--
-- 27 public tables lacked a service_role SELECT grant. This migration
-- restores the standard Supabase posture: service_role can read/write
-- every public table and sequence, and future tables inherit the grants
-- via default privileges. It does not widen anon/authenticated access;
-- row-level security policies still govern those roles.
--
-- Already applied to production on 2026-11-28 via the Supabase
-- Management API (recorded in supabase_migrations.schema_migrations);
-- this file keeps the repository authoritative.

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
