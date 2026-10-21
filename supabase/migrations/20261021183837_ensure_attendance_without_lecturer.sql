-- Lecturer assignment controls delegated access, but it must not prevent an
-- authorized workspace owner/admin from opening attendance. Some databases
-- may still have the pre-20261005 school_manage body, so remove that narrow
-- legacy guard without replacing the rest of the function.
do $$
declare
  fn text;
  old_guard text := 'if not exists(select 1 from public.course_lecturers where course_id=cls.course_id) then raise exception ''Assign a lecturer before opening attendance'' using errcode=''22023'';end if;';
begin
  select pg_get_functiondef('public.school_manage(text,jsonb)'::regprocedure) into fn;

  if position(old_guard in fn) > 0 then
    execute replace(fn, old_guard, '');
  end if;

  select pg_get_functiondef('public.school_manage(text,jsonb)'::regprocedure) into fn;
  if position(old_guard in fn) > 0 then
    raise exception 'Could not remove the legacy lecturer requirement from school_manage';
  end if;
end
$$;
