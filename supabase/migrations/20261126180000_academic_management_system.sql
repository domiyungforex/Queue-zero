-- TuRnMaRk Academic Management, Assignments, Assessment & Intelligence System
-- Additive migration reusing businesses, business_members, faculties, departments, courses, school_profiles, and people.

begin;

-- 1. Academic Settings & Grading Scales per Organization
create table if not exists public.academic_settings (
  organization_id uuid primary key references public.businesses(id) on delete cascade,
  default_max_score integer not null default 100 check (default_max_score between 10 and 1000),
  ca_weight_percent integer not null default 30 check (ca_weight_percent between 0 and 100),
  exam_weight_percent integer not null default 70 check (exam_weight_percent between 0 and 100),
  grading_scale jsonb not null default '[{"grade":"A","min":70,"max":100},{"grade":"B","min":60,"max":69.99},{"grade":"C","min":50,"max":59.99},{"grade":"D","min":45,"max":49.99},{"grade":"E","min":40,"max":44.99},{"grade":"F","min":0,"max":39.99}]'::jsonb,
  allow_regrade_requests boolean not null default true,
  regrade_window_days integer not null default 7 check (regrade_window_days between 1 and 90),
  cross_assignment_similarity boolean not null default false,
  ai_assisted_marking_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2. Assignments
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  course_id uuid not null,
  created_by text not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  instructions text,
  learning_objectives text,
  academic_session text,
  semester text,
  class_group text,
  category text not null default 'HOMEWORK' check (category in (
    'HOMEWORK','CLASSWORK','TAKE_HOME','INDIVIDUAL_PROJECT','GROUP_PROJECT',
    'PRACTICAL','LAB_REPORT','RESEARCH_PAPER','ESSAY','CONTINUOUS_ASSESSMENT','EXAM','OTHER'
  )),
  status text not null default 'DRAFT' check (status in ('DRAFT','SCHEDULED','PUBLISHED','CLOSED','ARCHIVED')),
  opens_at timestamptz,
  due_at timestamptz,
  closes_at timestamptz,
  scheduled_publish_at timestamptz,
  published_at timestamptz,
  max_attempts integer not null default 1 check (max_attempts between 1 and 20),
  late_policy text not null default 'ALLOW_WITH_FLAG' check (late_policy in ('BLOCK','ALLOW_WITH_FLAG','ALLOW_PENALTY')),
  late_penalty_percent integer not null default 0 check (late_penalty_percent between 0 and 100),
  allowed_formats text[] not null default array['TEXT','PDF','DOCX','IMAGE','CAMERA'],
  max_upload_mb integer not null default 10 check (max_upload_mb between 1 and 50),
  submission_mode text not null default 'INDIVIDUAL' check (submission_mode in ('INDIVIDUAL','GROUP')),
  allow_text_answer boolean not null default true,
  allow_file_upload boolean not null default true,
  allow_photo_submission boolean not null default true,
  allow_edit_after_submit boolean not null default false,
  allow_resubmission boolean not null default false,
  marking_mode text not null default 'HYBRID' check (marking_mode in ('AUTO_OBJECTIVE','MANUAL','AI_ASSISTED','HYBRID')),
  total_marks numeric(8,2) not null default 100 check (total_marks > 0),
  release_marks_immediately boolean not null default false,
  grades_published boolean not null default false,
  grades_published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (course_id, organization_id) references public.courses(id, organization_id)
);

create index if not exists assignments_org_course_idx on public.assignments (organization_id, course_id, status) where deleted_at is null;
create index if not exists assignments_due_idx on public.assignments (organization_id, due_at) where deleted_at is null;

-- 3. Assignment Questions
create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  position integer not null default 1,
  question_type text not null check (question_type in (
    'MCQ','TRUE_FALSE','SHORT_ANSWER','LONG_ANSWER','ESSAY','MATH','PRACTICAL_FILE','MATCHING','FILL_GAP'
  )),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 10000),
  description text,
  formula_latex text,
  options jsonb default '[]'::jsonb,
  marks numeric(8,2) not null default 10 check (marks >= 0),
  negative_marks numeric(8,2) not null default 0 check (negative_marks >= 0),
  partial_credit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade
);

create index if not exists assignment_questions_idx on public.assignment_questions (assignment_id, position);

-- 4. Answer Keys & Marking Rubrics (Restricted: never exposed to students)
create table if not exists public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  question_id uuid not null,
  accepted_answers jsonb not null default '[]'::jsonb,
  model_answer text,
  expected_formula text,
  expected_unit text,
  numeric_tolerance numeric(10,4) default 0,
  decimal_precision integer,
  case_sensitive boolean not null default false,
  key_concepts text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade,
  foreign key (question_id, organization_id) references public.assignment_questions(id, organization_id) on delete cascade
);

create table if not exists public.marking_rubrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  question_id uuid,
  title text not null,
  criteria jsonb not null default '[]'::jsonb,
  max_marks numeric(8,2) not null default 10,
  is_reusable boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade
);

-- 5. Assignment Reference Attachments
create table if not exists public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  storage_path text not null,
  uploaded_by text not null,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade
);

-- 6. Assignment Groups (for Group Assignments)
create table if not exists public.assignment_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  leader_student_id uuid,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade
);

create table if not exists public.assignment_group_members (
  group_id uuid not null,
  organization_id uuid not null,
  student_id uuid not null,
  contribution_note text,
  primary key (group_id, student_id),
  foreign key (group_id, organization_id) references public.assignment_groups(id, organization_id) on delete cascade,
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

-- 7. Student Submissions, Answers, Files & Versions
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  student_id uuid not null,
  group_id uuid,
  submission_reference text not null unique,
  request_id uuid not null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT','SUBMITTED','LATE','AUTO_MARKED','UNDER_REVIEW','MARKED','RETURNED','RESUBMITTED'
  )),
  attempt_number integer not null default 1 check (attempt_number >= 1),
  text_content text,
  answers_json jsonb not null default '{}'::jsonb,
  is_late boolean not null default false,
  submitted_at timestamptz,
  last_autosaved_at timestamptz,
  auto_score numeric(8,2),
  final_score numeric(8,2),
  lecturer_remarks text,
  graded_by text,
  graded_at timestamptz,
  grade_released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id, attempt_number),
  unique (assignment_id, student_id, request_id),
  unique (id, organization_id),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade,
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

create index if not exists submissions_assignment_idx on public.assignment_submissions (assignment_id, status);
create index if not exists submissions_student_idx on public.assignment_submissions (organization_id, student_id);

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  submission_id uuid not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  storage_path text not null,
  page_order integer not null default 1,
  is_handwritten boolean not null default false,
  immutable_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade
);

create table if not exists public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  submission_id uuid not null,
  version_number integer not null,
  text_content text,
  answers_json jsonb not null default '{}'::jsonb,
  snapshot_files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade
);

-- 8. Per-question Grading Results, Lecturer Feedback & Regrade Reviews
create table if not exists public.grading_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  submission_id uuid not null,
  question_id uuid not null,
  awarded_marks numeric(8,2) not null default 0,
  max_marks numeric(8,2) not null default 0,
  marking_source text not null default 'MANUAL' check (marking_source in ('AUTO_OBJECTIVE','AI_SUGGESTED','MANUAL','HYBRID')),
  ai_suggested_marks numeric(8,2),
  ai_explanation text,
  ai_confidence text check (ai_confidence in ('HIGH','MEDIUM','LOW')),
  criteria_satisfied text[] default '{}',
  criteria_missing text[] default '{}',
  lecturer_comment text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id),
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade,
  foreign key (question_id, organization_id) references public.assignment_questions(id, organization_id) on delete cascade
);

create table if not exists public.grade_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  submission_id uuid not null,
  student_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 2000),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','RESOLVED')),
  previous_score numeric(8,2),
  amended_score numeric(8,2),
  reviewer_id text,
  reviewer_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade
);

create table if not exists public.gradebook_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  course_id uuid not null,
  student_id uuid not null,
  ca_score numeric(8,2) not null default 0,
  exam_score numeric(8,2) not null default 0,
  total_score numeric(8,2) not null default 0,
  letter_grade text,
  lecturer_remarks text,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PUBLISHED','AMENDED')),
  audit_history jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (course_id, student_id),
  foreign key (course_id, organization_id) references public.courses(id, organization_id) on delete cascade,
  foreign key (student_id, organization_id) references public.school_profiles(id, organization_id) on delete cascade
);

-- 9. Question Bank
create table if not exists public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  course_id uuid,
  created_by text not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  prompt text not null,
  subject text,
  topic text,
  difficulty text not null default 'MEDIUM' check (difficulty in ('EASY','MEDIUM','HARD')),
  question_type text not null check (question_type in (
    'MCQ','TRUE_FALSE','SHORT_ANSWER','LONG_ANSWER','ESSAY','MATH','PRACTICAL_FILE','MATCHING','FILL_GAP'
  )),
  options jsonb default '[]'::jsonb,
  correct_answer jsonb default '{}'::jsonb,
  marks numeric(8,2) not null default 10,
  explanation text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

-- 10. Document Processing Jobs (OCR & Handwriting)
create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  submission_id uuid not null,
  submission_file_id uuid,
  status text not null default 'QUEUED' check (status in (
    'UPLOADED','QUEUED','PROCESSING','COMPLETED','PARTIALLY_COMPLETED','FAILED','NEEDS_REVIEW'
  )),
  extracted_text text,
  extracted_math text,
  page_count integer default 1,
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade
);

-- 11. Academic Integrity & AI Risk Assessments
create table if not exists public.similarity_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  submission_a_id uuid not null,
  submission_b_id uuid not null,
  similarity_score numeric(5,2) not null check (similarity_score between 0 and 100),
  matching_passages jsonb not null default '[]'::jsonb,
  explanation text,
  review_status text not null default 'PENDING' check (review_status in ('PENDING','DISMISSED','INVESTIGATING','ESCALATED','RESOLVED')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade
);

create table if not exists public.ai_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.businesses(id) on delete cascade,
  assignment_id uuid not null,
  submission_id uuid not null unique,
  risk_category text not null default 'INCONCLUSIVE' check (risk_category in ('LOW','MEDIUM','HIGH','INCONCLUSIVE')),
  indicators jsonb not null default '[]'::jsonb,
  excerpts jsonb not null default '[]'::jsonb,
  method text not null default 'heuristic_stylometric_v1',
  limitations_note text not null default 'AI-writing indicators are probabilistic signals and never conclusive proof of misconduct.',
  review_status text not null default 'PENDING' check (review_status in ('PENDING','DISMISSED','REVIEWED','APPEALED')),
  student_explanation text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.assignments(id, organization_id) on delete cascade,
  foreign key (submission_id, organization_id) references public.assignment_submissions(id, organization_id) on delete cascade
);

-- 12. RLS & Permissions
do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_settings','assignments','assignment_questions','answer_keys',
    'marking_rubrics','assignment_attachments','assignment_groups','assignment_group_members',
    'assignment_submissions','submission_files','submission_versions','grading_results',
    'grade_reviews','gradebook_entries','question_bank_items','document_processing_jobs',
    'similarity_matches','ai_risk_assessments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Course-scoped read/write policies (lecturers/admins/owners see their authorized courses; students see published assignments & own submissions)
create policy academic_settings_read on public.academic_settings for select to authenticated
  using (exists(select 1 from public.business_members m where m.business_id = organization_id and m.clerk_user_id = private.current_clerk_user_id()));
create policy academic_settings_write on public.academic_settings for all to authenticated
  using (private.school_manager(organization_id))
  with check (private.school_manager(organization_id));

create policy assignments_read on public.assignments for select to authenticated
  using (
    deleted_at is null and (
      private.school_course_access(course_id)
      or (status in ('PUBLISHED','CLOSED') and exists(
        select 1 from public.people p where p.organization_id = assignments.organization_id and p.clerk_user_id = private.current_clerk_user_id()
      ))
    )
  );
create policy assignments_write on public.assignments for all to authenticated
  using (private.school_course_access(course_id))
  with check (private.school_course_access(course_id));

create policy questions_read on public.assignment_questions for select to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and a.deleted_at is null and (
    private.school_course_access(a.course_id) or a.status in ('PUBLISHED','CLOSED')
  )));
create policy questions_write on public.assignment_questions for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

-- Answer keys & rubrics: NEVER readable by students
create policy answer_keys_staff_only on public.answer_keys for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy rubrics_staff_only on public.marking_rubrics for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy attachments_read on public.assignment_attachments for select to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and a.deleted_at is null));
create policy attachments_write on public.assignment_attachments for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy submissions_read on public.assignment_submissions for select to authenticated
  using (
    exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id))
    or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id())
  );
create policy submissions_write on public.assignment_submissions for all to authenticated
  using (
    exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id))
    or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id())
  )
  with check (
    exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id))
    or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id())
  );

create policy submission_files_access on public.submission_files for all to authenticated
  using (exists(select 1 from public.assignment_submissions s where s.id = submission_id))
  with check (exists(select 1 from public.assignment_submissions s where s.id = submission_id));

create policy submission_versions_access on public.submission_versions for all to authenticated
  using (exists(select 1 from public.assignment_submissions s where s.id = submission_id))
  with check (exists(select 1 from public.assignment_submissions s where s.id = submission_id));

create policy grading_results_access on public.grading_results for all to authenticated
  using (exists(select 1 from public.assignment_submissions s where s.id = submission_id))
  with check (exists(select 1 from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id where s.id = submission_id and private.school_course_access(a.course_id)));

create policy grade_reviews_access on public.grade_reviews for all to authenticated
  using (exists(select 1 from public.assignment_submissions s where s.id = submission_id))
  with check (exists(select 1 from public.assignment_submissions s where s.id = submission_id));

create policy gradebook_access on public.gradebook_entries for all to authenticated
  using (private.school_course_access(course_id) or exists(select 1 from public.people p where p.id = student_id and p.clerk_user_id = private.current_clerk_user_id()))
  with check (private.school_course_access(course_id));

create policy question_bank_staff on public.question_bank_items for all to authenticated
  using (private.school_staff(organization_id))
  with check (private.school_staff(organization_id));

create policy doc_jobs_access on public.document_processing_jobs for all to authenticated
  using (exists(select 1 from public.assignment_submissions s where s.id = submission_id))
  with check (exists(select 1 from public.assignment_submissions s where s.id = submission_id));

create policy similarity_staff_only on public.similarity_matches for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy ai_risk_staff_only on public.ai_risk_assessments for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy groups_access on public.assignment_groups for all to authenticated
  using (exists(select 1 from public.assignments a where a.id = assignment_id and a.deleted_at is null))
  with check (exists(select 1 from public.assignments a where a.id = assignment_id and private.school_course_access(a.course_id)));

create policy group_members_access on public.assignment_group_members for all to authenticated
  using (exists(select 1 from public.assignment_groups g where g.id = group_id))
  with check (exists(select 1 from public.assignment_groups g join public.assignments a on a.id = g.assignment_id where g.id = group_id and private.school_course_access(a.course_id)));

commit;
