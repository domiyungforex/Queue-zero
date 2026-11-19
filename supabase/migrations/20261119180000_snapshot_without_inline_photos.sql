begin;

-- Dashboard reads were timing out because school_snapshot returned embedded
-- JPEG data URLs. Keep the stored bytes. Do not return them to the client.
CREATE OR REPLACE FUNCTION public.school_snapshot(p_organization_id uuid, p_course_id uuid DEFAULT NULL::uuid, p_class_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; course_filter uuid:=p_course_id;
begin
 if not private.school_staff(p_organization_id) then raise exception 'School unavailable' using errcode='42501'; end if;
 if p_class_id is not null then
  select course_id into course_filter from public.class_sessions where id=p_class_id and organization_id=p_organization_id;
  if course_filter is null or not private.school_class_access(p_class_id) or (p_course_id is not null and p_course_id<>course_filter) then raise exception 'Class unavailable' using errcode='42501'; end if;
 end if;
 if course_filter is not null and not exists(select 1 from public.courses where id=course_filter and organization_id=p_organization_id and private.school_course_access(id)) then raise exception 'Course unavailable' using errcode='42501'; end if;
 with allowed_courses as (select * from public.courses c where c.organization_id=p_organization_id and private.school_course_access(c.id) and (course_filter is null or c.id=course_filter)),
 allowed_classes as (select c.*,s.status,s.starts_at,s.ends_at from public.class_sessions c join public.sessions s on s.id=c.id where c.course_id in(select id from allowed_courses) and (p_class_id is null or c.id=p_class_id)),
 roster as (select e.course_id,e.student_id from public.course_students e where e.course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT'))
 union select c.course_id,r.student_id from public.class_roster r join allowed_classes c on c.id=r.class_session_id where p_class_id is not null)
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name,'mode',organization_mode,'timezone',timezone) from public.businesses where id=p_organization_id),
 'faculties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.faculties where organization_id=p_organization_id and (unit_id is null or private.unit_visible(organization_id,unit_id))),'[]'),
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'faculty_id',faculty_id,'name',name) order by name) from public.departments where organization_id=p_organization_id and (unit_id is null or private.unit_visible(organization_id,unit_id))),'[]'),
 'courses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'department_id',department_id,'code',code,'title',title) order by code) from allowed_courses),'[]'),
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'matric_number',sp.matric_number,'department_id',sp.department_id,'level',sp.level,'programme',sp.programme) order by p.full_name) from public.people p join public.school_profiles sp on sp.id=p.id where p.id in(select student_id from roster)),'[]'),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(r)) from roster r),'[]'),
 'lecturers',coalesce((select jsonb_agg(jsonb_build_object('course_id',l.course_id,'clerk_user_id',l.clerk_user_id,'display_name',l.display_name)) from (select course_id,clerk_user_id,display_name from public.course_lecturers where course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT')) union all select c.course_id,l.clerk_user_id,l.display_name from public.class_lecturers l join allowed_classes c on c.id=l.class_session_id where p_class_id is not null) l),'[]'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'course_id',course_id,'status',status,'starts_at',starts_at,'ends_at',ends_at,'late_after_minutes',late_after_minutes,'checkout_enabled',checkout_enabled,'arrival_open',arrival_open,'departure_required',departure_required,'planned_ends_at',planned_ends_at,'verification_mode',verification_mode,'title',title,'location_lat',location_lat,'location_lng',location_lng,'geofence_radius_meters',geofence_radius_meters) order by starts_at desc) from allowed_classes),'[]'),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'check_in_at',check_in_at,'check_out_at',check_out_at,'status',status,'flag_reason',flag_reason,'submitted_name',submitted_name,'submitted_matric_number',submitted_matric_number,'photo_url', case when photo_url is null or left(photo_url, 5) = 'data:' then null else photo_url end, 'has_photo', photo_url is not null,'location_lat',location_lat,'location_lng',location_lng,'location_accuracy_meters',location_accuracy_meters,'location_verified',location_verified,'location_captured_at',location_captured_at,'location_distance_meters',location_distance_meters,'location_status',location_status,'verification_mode',verification_mode)) from public.attendance_records where class_session_id in(select id from allowed_classes)),'[]'),
 'flags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'reason',reason,'created_at',created_at,'resolved_at',resolved_at,'resolution',resolution)) from public.attendance_flags where class_session_id in(select id from allowed_classes)),'[]')
 ) into result;
 return result;
end $function$;


create or replace function private.attendance_photo_reference()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.photo_url is not null and left(new.photo_url, 5) = 'data:' then
    new.photo_url := null;
  end if;
  return new;
end $$;

drop trigger if exists attendance_photo_reference on public.attendance_records;
create trigger attendance_photo_reference
  before insert or update of photo_url on public.attendance_records
  for each row execute function private.attendance_photo_reference();

commit;
