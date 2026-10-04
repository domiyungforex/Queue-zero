-- Enum extension must commit before the attendance migration uses new roles.
begin;
alter type public.business_role add value if not exists 'lecturer';
alter type public.business_role add value if not exists 'student';
create type public.organization_mode as enum ('BUSINESS','SCHOOL','HYBRID');
create type public.session_type as enum ('QUEUE','CLASS','VISIT','APPOINTMENT','EVENT','SHIFT');
create type public.session_status as enum ('DRAFT','SCHEDULED','OPEN','PAUSED','CLOSED','COMPLETED');
create type public.person_type as enum ('CUSTOMER','STUDENT','EMPLOYEE','VISITOR','GUEST');
create type public.attendance_status as enum ('PRESENT','LATE','ABSENT','EARLY_LEAVE','INCOMPLETE','EXCUSED','FLAGGED');
alter table public.businesses add column organization_mode public.organization_mode not null default 'BUSINESS';
commit;
