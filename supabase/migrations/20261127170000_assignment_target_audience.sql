-- Add lecturer-selectable target audience / eligibility for assignments

alter table public.assignments
  add column if not exists target_audience text not null default 'ALL_INSTITUTION'
    check (target_audience in ('ALL_INSTITUTION', 'COURSE_ENROLLED', 'CLASS_ATTENDEES', 'DEPARTMENT_LEVEL')),
  add column if not exists target_department text,
  add column if not exists target_level text,
  add column if not exists target_class_session_id uuid references public.class_sessions(id) on delete set null;
