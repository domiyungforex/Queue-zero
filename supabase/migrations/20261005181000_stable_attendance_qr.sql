create or replace function public.school_issue_qr(
  p_class_id uuid,
  p_nonce uuid,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  cls public.class_sessions%rowtype;
  org uuid;
begin
  select * into cls from public.class_sessions where id=p_class_id;
  if not found then raise exception 'Class unavailable' using errcode='42501'; end if;

  perform 1 from public.businesses where id=cls.organization_id for share;
  org:=private.school_lock_course(cls.course_id);

  select * into cls from public.class_sessions where id=p_class_id for update;
  if not exists(select 1 from public.sessions where id=p_class_id and status='OPEN')
    or not(cls.arrival_open or cls.checkout_enabled)
  then
    raise exception 'Attendance is closed' using errcode='22023';
  end if;

  if p_nonce is null
    or p_expires_at is null
    or p_expires_at<=clock_timestamp()
    or p_expires_at>clock_timestamp()+interval '12 hours'
  then
    raise exception 'Invalid QR validity' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.attendance_qr_nonces
    where class_session_id=p_class_id
      and created_at>clock_timestamp()-interval '1 minute'
  )>=6 then
    raise exception 'Please wait before regenerating the QR' using errcode='54000';
  end if;

  delete from public.attendance_qr_nonces where class_session_id=p_class_id;

  insert into public.attendance_qr_nonces(nonce,organization_id,class_session_id,expires_at)
  values(p_nonce,org,p_class_id,p_expires_at);

  return jsonb_build_object(
    'organization_id',org,
    'session_id',p_class_id,
    'expires_at',p_expires_at
  );
end
$$;
