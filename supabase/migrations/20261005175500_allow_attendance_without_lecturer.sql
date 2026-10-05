do $$
declare
  fn text;
  old_guard text := 'if not exists(select 1 from public.course_lecturers where course_id=cls.course_id) then raise exception ''Assign a lecturer before opening attendance'' using errcode=''22023'';end if;';
begin
  select pg_get_functiondef('public.school_manage(text,jsonb)'::regprocedure) into fn;
  if position(old_guard in fn) = 0 then
    raise exception 'Expected lecturer guard was not found in school_manage';
  end if;
  fn := replace(fn, old_guard, '');
  execute fn;
end
$$;
