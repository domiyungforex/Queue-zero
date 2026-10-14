begin;
alter table public.businesses add column institution_type text check(institution_type in ('UNIVERSITY','POLYTECHNIC','COLLEGE','SECONDARY_SCHOOL','TRAINING_INSTITUTION','OTHER'));
create table public.organization_units(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.businesses(id),parent_unit_id uuid,
 name text not null check(length(btrim(name)) between 1 and 160),type text not null check(type in ('FACULTY','DEPARTMENT','MEDICAL_CENTER','COUNSELING_CENTER','BURSARY','ADMISSIONS','STUDENT_AFFAIRS','ICT','LIBRARY','ADMINISTRATION','CUSTOM')),
 slug text not null,status text not null default 'active' check(status in ('active','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(organization_id,slug),foreign key(parent_unit_id,organization_id) references public.organization_units(id,organization_id),check(parent_unit_id is distinct from id));
create index organization_units_parent on public.organization_units(organization_id,parent_unit_id);
alter table public.business_members add unique(id,business_id);
create table public.unit_memberships(
 organization_id uuid not null,unit_id uuid not null,member_id uuid not null,role text not null check(role in ('UNIT_ADMIN','STAFF','LECTURER')),staff_title text check(length(staff_title)<=80),permissions text[] not null default '{}',created_at timestamptz not null default now(),
 primary key(unit_id,member_id),foreign key(unit_id,organization_id) references public.organization_units(id,organization_id),foreign key(member_id,organization_id) references public.business_members(id,business_id) on delete cascade,
 check(cardinality(permissions)<=15 and permissions <@ array['unit.manage','unit.staff.manage','queue.create','queue.manage','queue.serve','course.create','course.manage','attendance.start','attendance.manage','attendance.export','appointments.create','appointments.manage','reports.view']::text[]));
create index unit_memberships_member on public.unit_memberships(member_id,organization_id);
alter table public.queues add column unit_id uuid,add foreign key(unit_id,business_id) references public.organization_units(id,organization_id);
alter table public.faculties add column unit_id uuid,add foreign key(unit_id,organization_id) references public.organization_units(id,organization_id);
alter table public.departments add column unit_id uuid,add foreign key(unit_id,organization_id) references public.organization_units(id,organization_id);
alter table public.courses add column unit_id uuid,add foreign key(unit_id,organization_id) references public.organization_units(id,organization_id);
create index queues_unit on public.queues(business_id,unit_id);
create index courses_unit on public.courses(organization_id,unit_id);
create table public.institution_invitations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,unit_id uuid not null,email text not null check(length(email)<=254 and email=lower(btrim(email))),role text not null check(role in ('UNIT_ADMIN','STAFF','LECTURER')),staff_title text,permissions text[] not null,
 token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),invited_by text not null,expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now(),accepted_at timestamptz,accepted_by text,revoked_at timestamptz,
 foreign key(unit_id,organization_id) references public.organization_units(id,organization_id));
create index institution_invitations_org on public.institution_invitations(organization_id,unit_id,created_at desc);
create table public.institution_services(id uuid primary key default gen_random_uuid(),organization_id uuid not null,unit_id uuid not null,name text not null check(length(btrim(name)) between 1 and 160),kind text not null check(kind in ('QUEUE','APPOINTMENT')),queue_id uuid references public.queues(id),created_at timestamptz not null default now(),unique(id,organization_id,unit_id),foreign key(unit_id,organization_id) references public.organization_units(id,organization_id));
create table public.appointments(id uuid primary key default gen_random_uuid(),organization_id uuid not null,unit_id uuid not null,service_id uuid not null,staff_id uuid,user_id text,guest_name text check(length(guest_name)<=160),scheduled_at timestamptz not null check(isfinite(scheduled_at)),status text not null default 'SCHEDULED' check(status in ('SCHEDULED','ARRIVED','COMPLETED','CANCELLED','NO_SHOW')),created_at timestamptz not null default now(),foreign key(service_id,organization_id,unit_id) references public.institution_services(id,organization_id,unit_id),foreign key(staff_id,organization_id) references public.business_members(id,business_id));
create unique index appointment_staff_slot on public.appointments(organization_id,staff_id,scheduled_at) where staff_id is not null and status in ('SCHEDULED','ARRIVED');
create index appointments_unit_time on public.appointments(organization_id,unit_id,scheduled_at);
-- Scheduling writes deliberately remain unavailable until a bounded booking workflow exists.
create function private.institution_admin(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(private.business_role_for(p_org) in ('owner','admin'),false)$$;
create function private.unit_permission(p_org uuid,p_unit uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_units u where u.id=p_unit and u.organization_id=p_org and u.status='active' and (private.institution_admin(p_org) or exists(select 1 from public.unit_memberships a join public.business_members m on m.id=a.member_id where a.unit_id=u.id and m.clerk_user_id=private.current_clerk_user_id() and p_permission=any(a.permissions))));$$;
create function private.unit_visible(p_org uuid,p_unit uuid) returns boolean language sql stable security definer set search_path='' as $$select private.institution_admin(p_org) or exists(select 1 from public.unit_memberships a join public.business_members m on m.id=a.member_id join public.organization_units u on u.id=a.unit_id where a.organization_id=p_org and a.unit_id=p_unit and m.clerk_user_id=private.current_clerk_user_id() and u.status='active')$$;
create function private.lock_unit_permission(p_org uuid,p_unit uuid,p_permission text) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.business_members where business_id=p_org and clerk_user_id=private.current_clerk_user_id() for share;
 perform 1 from public.unit_memberships a where a.unit_id=p_unit and a.member_id in(select id from public.business_members where business_id=p_org and clerk_user_id=private.current_clerk_user_id()) for share;
 if not private.unit_permission(p_org,p_unit,p_permission) then raise exception 'Unit permission required' using errcode='42501';end if;end$$;
create function private.unit_tree_guard() returns trigger language plpgsql security definer set search_path='' as $$declare cursor_id uuid:=new.parent_unit_id;n integer:=0;begin
 while cursor_id is not null loop
 n:=n+1;if cursor_id=new.id or n>12 then raise exception 'Invalid unit hierarchy' using errcode='22023';end if;
 select parent_unit_id into cursor_id from public.organization_units where id=cursor_id and organization_id=new.organization_id;
 end loop;return new;end$$;
create trigger unit_tree_guard before insert or update of parent_unit_id on public.organization_units for each row execute function private.unit_tree_guard();
create function public.institution_setup(p_organization_id uuid,p_type text) returns void language plpgsql security definer set search_path='' as $$declare root_unit uuid;f record;d record;u uuid;begin
 perform 1 from public.businesses where id=p_organization_id for update;perform private.lock_business_manager(p_organization_id);
 if p_type is null or p_type not in ('UNIVERSITY','POLYTECHNIC','COLLEGE','SECONDARY_SCHOOL','TRAINING_INSTITUTION','OTHER') then raise exception 'Invalid institution type' using errcode='22023';end if;
 update public.businesses set institution_type=p_type,organization_mode='HYBRID' where id=p_organization_id;
 insert into public.organization_units(organization_id,name,type,slug) values(p_organization_id,'Administration','ADMINISTRATION','administration') on conflict(organization_id,slug) do nothing;
 select id into root_unit from public.organization_units where organization_id=p_organization_id and slug='administration';
 update public.queues set unit_id=root_unit where business_id=p_organization_id and unit_id is null;
 for f in select * from public.faculties where organization_id=p_organization_id and unit_id is null loop
 insert into public.organization_units(organization_id,name,type,slug) values(p_organization_id,f.name,'FACULTY','faculty-'||f.id) returning id into u;update public.faculties set unit_id=u where id=f.id;end loop;
 for d in select d.*,f.unit_id as parent from public.departments d join public.faculties f on f.id=d.faculty_id where d.organization_id=p_organization_id and d.unit_id is null loop
 insert into public.organization_units(organization_id,parent_unit_id,name,type,slug) values(p_organization_id,d.parent,d.name,'DEPARTMENT','department-'||d.id) returning id into u;update public.departments set unit_id=u where id=d.id;end loop;
 update public.courses c set unit_id=d.unit_id from public.departments d where c.department_id=d.id and c.organization_id=p_organization_id and c.unit_id is null;
 -- Preserve existing staff access at the explicit unit boundary during conversion.
 insert into public.unit_memberships(organization_id,unit_id,member_id,role,permissions)
 select distinct p_organization_id,q.unit_id,a.business_member_id,'STAFF',array['queue.serve'] from public.queue_staff_assignments a join public.queues q on q.id=a.queue_id where q.business_id=p_organization_id on conflict do nothing;
 insert into public.unit_memberships(organization_id,unit_id,member_id,role,permissions)
 select distinct p_organization_id,c.unit_id,m.id,'LECTURER',array['course.create','course.manage','attendance.start','attendance.manage','attendance.export'] from public.course_lecturers l join public.courses c on c.id=l.course_id join public.business_members m on m.business_id=l.organization_id and m.clerk_user_id=l.clerk_user_id where c.organization_id=p_organization_id on conflict do nothing;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_organization_id,'institution_configured',private.current_clerk_user_id(),jsonb_build_object('institution_type',p_type));
end$$;
create function public.onboard_institution(p_business_name text,p_industry text,p_country_code text,p_timezone text,p_location_name text,p_location_address text,p_mode public.organization_mode,p_institution_type text) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid;begin org:=public.onboard_organization(p_business_name,p_industry,p_country_code,p_timezone,p_location_name,p_location_address,p_mode);perform public.institution_setup(org,p_institution_type);return org;end$$;
create function public.institution_has_permission(p_organization_id uuid,p_unit_id uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$select case when p_unit_id is null then private.institution_admin(p_organization_id) else private.unit_permission(p_organization_id,p_unit_id,p_permission) end$$;
create function private.validate_unit_grant(p_org uuid,p_unit uuid,p_role text,p_permissions text[]) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.lock_unit_permission(p_org,p_unit,'unit.staff.manage');
 if p_role is null or p_role not in ('UNIT_ADMIN','STAFF','LECTURER') or p_permissions is null or cardinality(p_permissions)>13 or not(p_permissions<@array['unit.manage','unit.staff.manage','queue.create','queue.manage','queue.serve','course.create','course.manage','attendance.start','attendance.manage','attendance.export','appointments.create','appointments.manage','reports.view']::text[]) then raise exception 'Invalid unit permissions' using errcode='22023';end if;
 if not private.institution_admin(p_org) and exists(select 1 from unnest(p_permissions) p where not private.unit_permission(p_org,p_unit,p)) then raise exception 'Cannot delegate unavailable permissions' using errcode='42501';end if;end$$;
create function public.institution_manage(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(p_payload->>'organization_id')::uuid;unit uuid:=(p_payload->>'unit_id')::uuid;member uuid:=(p_payload->>'member_id')::uuid;result_id uuid;perms text[];actor text:=private.current_clerk_user_id();old_role public.business_role;parent uuid:=(p_payload->>'parent_unit_id')::uuid;begin
 if actor is null or p_payload is null or octet_length(p_payload::text)>32768 then raise exception 'Not authorized' using errcode='42501';end if;
 perform 1 from public.businesses where id=org and institution_type is not null for update;if not found then raise exception 'Institution unavailable' using errcode='42501';end if;
 if p_action='create_unit' then
 perform private.lock_business_manager(org);
 insert into public.organization_units(organization_id,parent_unit_id,name,type,slug) values(org,parent,btrim(p_payload->>'name'),p_payload->>'type',coalesce(nullif(trim(both '-' from regexp_replace(lower(btrim(p_payload->>'name')),'[^a-z0-9]+','-','g')),''),'unit')||'-'||substr(gen_random_uuid()::text,1,8)) returning id into result_id;
 if p_payload->>'type'='FACULTY' then insert into public.faculties(organization_id,name,unit_id) values(org,btrim(p_payload->>'name'),result_id);
 elsif p_payload->>'type'='DEPARTMENT' then
 if not exists(select 1 from public.faculties where unit_id=parent and organization_id=org) then raise exception 'Choose a faculty as department parent' using errcode='22023';end if;
 insert into public.departments(organization_id,faculty_id,name,unit_id) select org,id,btrim(p_payload->>'name'),result_id from public.faculties where unit_id=parent and organization_id=org;
 end if;
 elsif p_action='update_unit' then
 perform private.lock_unit_permission(org,unit,'unit.manage');
 if not private.institution_admin(org) and parent is distinct from (select parent_unit_id from public.organization_units where id=unit) then raise exception 'Administrator required to move units' using errcode='42501';end if;
 update public.organization_units set name=btrim(p_payload->>'name'),parent_unit_id=parent,status=p_payload->>'status',updated_at=clock_timestamp() where id=unit and organization_id=org returning id into result_id;
 update public.faculties set name=btrim(p_payload->>'name') where unit_id=unit;
 update public.departments set name=btrim(p_payload->>'name') where unit_id=unit;
 elsif p_action='assign_member' then
 select array_agg(value) into perms from jsonb_array_elements_text(p_payload->'permissions');perms:=coalesce(perms,'{}');
 perform private.validate_unit_grant(org,unit,p_payload->>'role',perms);
 select role into old_role from public.business_members where id=member and business_id=org for update;
 if old_role is null or old_role in ('owner','admin','student') then raise exception 'Choose an institution staff member' using errcode='42501';end if;
 if not private.institution_admin(org) and exists(select 1 from public.business_members where id=member and clerk_user_id=actor) then raise exception 'Cannot change your own assignment' using errcode='42501';end if;
 insert into public.unit_memberships(organization_id,unit_id,member_id,role,staff_title,permissions) values(org,unit,member,p_payload->>'role',nullif(btrim(p_payload->>'staff_title'),''),perms) on conflict(unit_id,member_id) do update set role=excluded.role,staff_title=excluded.staff_title,permissions=excluded.permissions;result_id:=member;
 elsif p_action in ('remove_member','remove_assignment') then
 -- Serialize after existing resource operations, then revoke memberships atomically.
 perform 1 from public.queues where business_id=org order by id for update;
 perform 1 from public.courses where organization_id=org order by id for update;
 if p_action='remove_member' then perform private.lock_business_manager(org);else perform private.lock_unit_permission(org,unit,'unit.staff.manage');end if;
 select role into old_role from public.business_members where id=member and business_id=org for update;
 if old_role is null or old_role='owner' or exists(select 1 from public.business_members where id=member and clerk_user_id=actor) or (old_role='admin' and private.business_role_for(org)<>'owner') then raise exception 'Cannot remove this member' using errcode='42501';end if;
 if p_action='remove_assignment' then
 delete from public.unit_memberships where unit_id=unit and member_id=member;
 else
 delete from public.course_lecturers where organization_id=org and clerk_user_id=(select clerk_user_id from public.business_members where id=member);
 delete from public.queue_staff_assignments where business_member_id=member;
 update public.institution_invitations set revoked_at=clock_timestamp() where organization_id=org and (accepted_by=(select clerk_user_id from public.business_members where id=member) or invited_by=(select clerk_user_id from public.business_members where id=member)) and revoked_at is null;
 delete from public.business_members where id=member;
 end if;result_id:=member;
 elsif p_action='assign_queue' then
 perform 1 from public.queues where id=(p_payload->>'queue_id')::uuid and business_id=org for update;
 if not found then raise exception 'Queue unavailable' using errcode='42501';end if;perform private.lock_business_manager(org);
 if not private.unit_visible(org,unit) then raise exception 'Unit unavailable' using errcode='42501';end if;
 update public.queues set unit_id=unit where id=(p_payload->>'queue_id')::uuid returning id into result_id;
 elsif p_action='export_generated' then
 perform private.lock_unit_permission(org,unit,'attendance.export');result_id:=(p_payload->>'class_id')::uuid;
 if not exists(select 1 from public.class_sessions c join public.courses co on co.id=c.course_id where c.id=result_id and c.organization_id=org and co.unit_id=unit) then raise exception 'Class unavailable' using errcode='42501';end if;
 else raise exception 'Unknown institution action' using errcode='22023';end if;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(org,'institution_'||p_action,actor,jsonb_strip_nulls(jsonb_build_object('id',result_id,'unit_id',unit)));
 return jsonb_strip_nulls(jsonb_build_object('id',result_id,'message','Saved.'));
end$$;
alter table public.institution_invitations add column delivery_attempts integer not null default 0,add column delivery_lease_until timestamptz,add column delivered_at timestamptz,add column provider_id text;
create function public.institution_invite(p_organization_id uuid,p_unit_id uuid,p_email text,p_role text,p_staff_title text,p_permissions text[],p_token_hash text,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare prior public.institution_invitations;begin
 perform 1 from public.businesses where id=p_organization_id and institution_type is not null for update;
 if not found then raise exception 'Institution unavailable' using errcode='42501';end if;
 perform private.validate_unit_grant(p_organization_id,p_unit_id,p_role,p_permissions);
 if p_request_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_email is null or length(p_email)>254 or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_staff_title)>80 then raise exception 'Invalid invitation' using errcode='22023';end if;
 select * into prior from public.institution_invitations where id=p_request_id;
 if found then
 if prior.organization_id is distinct from p_organization_id or prior.unit_id is distinct from p_unit_id or prior.email is distinct from lower(btrim(p_email)) or prior.role is distinct from p_role or prior.permissions is distinct from p_permissions or prior.token_hash is distinct from p_token_hash or prior.staff_title is distinct from nullif(btrim(p_staff_title),'') then raise exception 'Invitation retry differs' using errcode='22023';end if;return prior.id;end if;
 if (select count(*) from public.institution_invitations where organization_id=p_organization_id and created_at>clock_timestamp()-interval '1 hour')>=1000 then raise exception 'Invitation limit reached' using errcode='54000';end if;
 insert into public.institution_invitations(id,organization_id,unit_id,email,role,staff_title,permissions,token_hash,invited_by) values(p_request_id,p_organization_id,p_unit_id,lower(btrim(p_email)),p_role,nullif(btrim(p_staff_title),''),p_permissions,p_token_hash,private.current_clerk_user_id());
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(p_organization_id,'staff_invited',private.current_clerk_user_id(),jsonb_build_object('invitation_id',p_request_id,'unit_id',p_unit_id));return p_request_id;end$$;
create function public.institution_invite_batch(p_organization_id uuid,p_invitations jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare item jsonb;ids uuid[]:='{}';perms text[];begin
 if p_invitations is null or jsonb_typeof(p_invitations)<>'array' or jsonb_array_length(p_invitations) not between 1 and 200 or octet_length(p_invitations::text)>262144 then raise exception 'Provide 1 to 200 invitations' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_invitations) loop
 select coalesce(array_agg(value),'{}') into perms from jsonb_array_elements_text(item->'permissions');
 ids:=array_append(ids,public.institution_invite(p_organization_id,(item->>'unit_id')::uuid,item->>'email',item->>'role',item->>'staff_title',perms,item->>'token_hash',(item->>'request_id')::uuid));end loop;
 return jsonb_build_object('count',cardinality(ids),'ids',ids);end$$;
create function public.institution_revoke_invitation(p_invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$declare inv public.institution_invitations;begin
 select * into inv from public.institution_invitations where id=p_invitation_id;
 perform 1 from public.businesses where id=inv.organization_id for update;
 perform private.lock_unit_permission(inv.organization_id,inv.unit_id,'unit.staff.manage');
 update public.institution_invitations set revoked_at=clock_timestamp() where id=inv.id and accepted_at is null;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(inv.organization_id,'invitation_revoked',private.current_clerk_user_id(),jsonb_build_object('invitation_id',inv.id));end$$;
create function public.institution_accept_invitation(p_token_hash text,p_user_id text,p_verified_email text) returns uuid language plpgsql security definer set search_path='' as $$declare inv public.institution_invitations;mid uuid;inviter uuid;begin
 select * into inv from public.institution_invitations where token_hash=p_token_hash;
 if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
 perform 1 from public.businesses where id=inv.organization_id for update;
 select * into inv from public.institution_invitations where id=inv.id for update;
 if inv.revoked_at is not null or inv.expires_at<=clock_timestamp() or p_user_id is null or p_user_id !~ '^user_[A-Za-z0-9]+$' or length(p_user_id)>255 or inv.email is distinct from lower(btrim(p_verified_email)) then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if inv.accepted_at is not null then
 if inv.accepted_by<>p_user_id or not exists(select 1 from public.business_members where business_id=inv.organization_id and clerk_user_id=p_user_id) then raise exception 'Invitation unavailable' using errcode='42501';end if;return inv.organization_id;end if;
 select id into inviter from public.business_members where business_id=inv.organization_id and clerk_user_id=inv.invited_by;
 if inviter is null or not exists(select 1 from public.organization_units where id=inv.unit_id and status='active') or not exists(select 1 from public.business_members m where m.id=inviter and (m.role in ('owner','admin') or exists(select 1 from public.unit_memberships a where a.member_id=m.id and a.unit_id=inv.unit_id and 'unit.staff.manage'=any(a.permissions) and inv.permissions<@a.permissions))) then raise exception 'Invitation unavailable' using errcode='42501';end if;
 insert into public.business_members(business_id,clerk_user_id,role) values(inv.organization_id,p_user_id,case when inv.role='LECTURER' then 'lecturer'::public.business_role else 'staff'::public.business_role end) on conflict(business_id,clerk_user_id) do nothing;
 select id into mid from public.business_members where business_id=inv.organization_id and clerk_user_id=p_user_id;
 insert into public.unit_memberships(organization_id,unit_id,member_id,role,staff_title,permissions) values(inv.organization_id,inv.unit_id,mid,inv.role,inv.staff_title,inv.permissions) on conflict(unit_id,member_id) do update set role=excluded.role,staff_title=excluded.staff_title,permissions=excluded.permissions;
 update public.institution_invitations set accepted_at=clock_timestamp(),accepted_by=p_user_id where id=inv.id;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(inv.organization_id,'staff_invitation_accepted',p_user_id,jsonb_build_object('member_id',mid,'unit_id',inv.unit_id));return inv.organization_id;end$$;
create function public.institution_claim_invitation_delivery(p_limit integer default 10) returns table(id uuid,email text) language plpgsql security definer set search_path='' as $$begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch size' using errcode='22023';end if;
 return query with selected as(select i.id from public.institution_invitations i where i.delivered_at is null and i.revoked_at is null and i.accepted_at is null and i.expires_at>clock_timestamp() and i.delivery_attempts<5 and (i.delivery_lease_until is null or i.delivery_lease_until<clock_timestamp()) order by i.created_at limit p_limit for update skip locked)
 update public.institution_invitations i set delivery_attempts=i.delivery_attempts+1,delivery_lease_until=clock_timestamp()+interval '5 minutes' from selected s where i.id=s.id returning i.id,i.email;end$$;
create function public.institution_finish_invitation_delivery(p_invitation_id uuid,p_success boolean,p_provider_id text default null) returns void language plpgsql security definer set search_path='' as $$begin
 update public.institution_invitations set delivered_at=case when p_success then clock_timestamp() else null end,provider_id=case when p_success then left(p_provider_id,255) else null end,delivery_lease_until=case when p_success then null else clock_timestamp()+interval '5 minutes' end where id=p_invitation_id and delivered_at is null;end$$;

create or replace function private.can_access_queue(target_queue_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.queues q join public.businesses b on b.id=q.business_id where q.id=target_queue_id and (case when b.institution_type is not null then private.unit_permission(q.business_id,q.unit_id,'queue.serve') or private.unit_permission(q.business_id,q.unit_id,'queue.manage') else private.institution_admin(q.business_id) or exists(select 1 from public.queue_staff_assignments a join public.business_members m on m.id=a.business_member_id where a.queue_id=q.id and m.role='staff' and m.clerk_user_id=private.current_clerk_user_id()) end))$$;
create or replace function private.can_manage_queue(target_queue_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.queues q join public.businesses b on b.id=q.business_id where q.id=target_queue_id and case when b.institution_type is not null then private.unit_permission(q.business_id,q.unit_id,'queue.manage') else private.institution_admin(q.business_id) end)$$;
create or replace function private.school_course_access(p_course uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.courses c join public.businesses b on b.id=c.organization_id where c.id=p_course and private.school_enabled(c.organization_id) and case when b.institution_type is not null then private.unit_permission(c.organization_id,c.unit_id,'course.manage') or private.unit_permission(c.organization_id,c.unit_id,'attendance.manage') or private.unit_permission(c.organization_id,c.unit_id,'attendance.start') or private.unit_permission(c.organization_id,c.unit_id,'attendance.export') else private.school_manager(c.organization_id) or exists(select 1 from public.course_lecturers l join public.business_members m on m.business_id=l.organization_id and m.clerk_user_id=l.clerk_user_id where l.course_id=c.id and l.clerk_user_id=private.current_clerk_user_id() and m.role in ('owner','admin','lecturer')) end)$$;
create or replace function private.school_staff(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select private.school_manager(p_org) or (private.school_enabled(p_org) and case when exists(select 1 from public.businesses where id=p_org and institution_type is not null) then exists(select 1 from public.unit_memberships a where a.organization_id=p_org and private.unit_visible(p_org,a.unit_id) and a.permissions && array['course.create','course.manage','attendance.start','attendance.manage','attendance.export']) else coalesce(private.business_role_for(p_org)='lecturer',false) end)$$;
create function private.lock_institution_course(p_course uuid,p_permission text) returns void language plpgsql security definer set search_path='' as $$declare c public.courses;begin select * into c from public.courses where id=p_course for update;if exists(select 1 from public.businesses where id=c.organization_id and institution_type is not null) then perform private.lock_unit_permission(c.organization_id,c.unit_id,p_permission);end if;end$$;
create or replace function public.call_next_ticket(p_queue_id uuid,p_request_id uuid)
returns table(outcome text,replayed boolean,ticket_id uuid,display_number text,
  customer_name text,called_at timestamptz,ticket_status public.ticket_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor text := private.current_clerk_user_id();
  q public.queues%rowtype;
  member public.business_members%rowtype;
  prior public.queue_call_requests%rowtype;
  chosen public.tickets%rowtype;
  result_outcome text;
  called_time timestamptz;
begin
  if p_queue_id is null or p_request_id is null then
    raise exception 'Queue and request IDs required' using errcode='22023';
  end if;
  -- Reject unknown/foreign queues identically, before taking a tenant row lock.
  if actor is null or not private.can_access_queue(p_queue_id) then
    raise exception 'Queue access required' using errcode='42501';
  end if;
  select * into q from public.queues where id=p_queue_id for update;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;

  -- Recheck permissions AFTER waiting for the queue lock. Share locks prevent
  -- membership/assignment revocation from committing midway through the action.
  select * into member from public.business_members
    where business_id=q.business_id and clerk_user_id=actor for share;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  if exists(select 1 from public.businesses where id=q.business_id and institution_type is not null) then
 perform private.lock_unit_permission(q.business_id,q.unit_id,'queue.serve');
 else
  if member.role not in ('owner','admin','staff') then raise exception 'Queue access required' using errcode='42501'; end if;
  if member.role='staff' then
    perform 1 from public.queue_staff_assignments
      where queue_id=q.id and business_member_id=member.id and business_id=q.business_id for share;
    if not found then raise exception 'Queue access required' using errcode='42501'; end if;
  end if;
 end if;

  select * into prior from public.queue_call_requests r where r.queue_id=q.id and r.request_id=p_request_id;
  if found then
    if prior.actor_user_id<>actor then raise exception 'Request unavailable' using errcode='42501'; end if;
    return query select prior.outcome,true,t.id,t.display_number,t.customer_name,t.called_at,t.status
      from (values(1)) as one(n) left join public.tickets t on t.id=prior.ticket_id and t.queue_id=q.id;
    return;
  end if;

  perform 1 from public.locations where id=q.location_id and business_id=q.business_id and is_active for share;
  if not found or q.status<>'open' then
    raise exception 'Queue is not available for calling' using errcode='QZ002';
  end if;
  select * into chosen from public.tickets where queue_id=q.id and status='serving' for update;
  if found then
    result_outcome := 'already_serving';
  else
    -- Do not SKIP LOCKED: queue-level serialization preserves strict FIFO,
    -- including customers from yesterday after daily number resets.
    select * into chosen from public.tickets where queue_id=q.id and status='waiting'
      order by joined_at,id limit 1 for update;
    if not found then
      result_outcome := 'empty';
    else
      called_time := clock_timestamp();
      update public.tickets set status='serving',called_at=called_time,estimated_wait_seconds=0
        where id=chosen.id returning * into chosen;
      insert into public.ticket_events(ticket_id,queue_id,type,actor_type,actor_id,metadata,created_at)
        values(chosen.id,q.id,'called','staff',actor,jsonb_build_object('request_id',p_request_id),called_time);
      result_outcome := 'called';
    end if;
  end if;
  insert into public.queue_call_requests(queue_id,request_id,actor_user_id,outcome,ticket_id)
    values(q.id,p_request_id,actor,result_outcome,chosen.id);
  return query select result_outcome,false,chosen.id,chosen.display_number,chosen.customer_name,chosen.called_at,chosen.status;
end;
$$;
create or replace function private.lock_operable_queue(p_queue_id uuid) returns public.queues
language plpgsql security definer set search_path='' as $$
declare q public.queues; m public.business_members;
begin
 if not private.can_access_queue(p_queue_id) then raise exception 'Queue access required' using errcode='42501'; end if;
 select * into q from public.queues where id=p_queue_id for update;
 select * into m from public.business_members where business_id=q.business_id and clerk_user_id=private.current_clerk_user_id() for share;
 if not found then raise exception 'Queue access required' using errcode='42501'; end if;
 if exists(select 1 from public.businesses where id=q.business_id and institution_type is not null) then
 perform private.lock_unit_permission(q.business_id,q.unit_id,'queue.serve');
 else
 if m.role not in ('owner','admin','staff') then raise exception 'Queue access required' using errcode='42501'; end if;
 if m.role='staff' then
  perform 1 from public.queue_staff_assignments where queue_id=q.id and business_member_id=m.id for share;
  if not found then raise exception 'Queue access required' using errcode='42501'; end if;
 end if;
 end if;
 return q;
end $$;
create or replace function public.update_queue(
  p_queue_id uuid, p_business_id uuid, p_expected_revision integer,
  p_location_id uuid, p_name text, p_description text, p_average_service_seconds integer,
  p_warning_threshold integer, p_allow_phone boolean, p_require_phone boolean
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  current_queue public.queues%rowtype;
  actor_id text := private.current_clerk_user_id();
begin
  if actor_id is null or not private.can_manage_queue(p_queue_id) then
    raise exception 'Queue management access required' using errcode = '42501';
  end if;
  select * into current_queue from public.queues where id = p_queue_id and business_id = p_business_id for update;
  if not found then raise exception 'Queue unavailable' using errcode = '42501'; end if;
  if exists(select 1 from public.businesses where id=p_business_id and institution_type is not null) then perform private.lock_unit_permission(p_business_id,current_queue.unit_id,'queue.manage');else perform private.lock_business_manager(p_business_id);end if;
  if p_expected_revision is distinct from current_queue.revision then
    raise exception 'Queue changed; reload before saving' using errcode = '40001';
  end if;
  perform private.validate_queue_settings(p_name, p_description, p_average_service_seconds, p_warning_threshold, p_allow_phone, p_require_phone);
  perform 1 from public.locations where id = p_location_id and business_id = p_business_id and is_active for share;
  if not found then raise exception 'Choose an active location in this business' using errcode = '22023'; end if;
  update public.queues set location_id = p_location_id, name = btrim(p_name), description = nullif(btrim(p_description), ''),
    average_service_seconds = p_average_service_seconds, warning_threshold = p_warning_threshold,
    allow_phone = p_allow_phone, require_phone = p_require_phone where id = p_queue_id;
  -- The public slug deliberately stays unchanged when names/settings change.
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (p_business_id, 'queue_updated', actor_id, jsonb_build_object('queue_id', p_queue_id, 'revision', current_queue.revision + 1));
  return p_queue_id;
end;
$$;
create or replace function public.set_queue_status(
  p_queue_id uuid, p_business_id uuid, p_expected_revision integer, p_status public.queue_status
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  current_queue public.queues%rowtype;
  actor_id text := private.current_clerk_user_id();
begin
  if actor_id is null or not private.can_manage_queue(p_queue_id) then
    raise exception 'Queue management access required' using errcode = '42501';
  end if;
  select * into current_queue from public.queues where id = p_queue_id and business_id = p_business_id for update;
  if not found then raise exception 'Queue unavailable' using errcode = '42501'; end if;
  if exists(select 1 from public.businesses where id=p_business_id and institution_type is not null) then perform private.lock_unit_permission(p_business_id,current_queue.unit_id,'queue.manage');else perform private.lock_business_manager(p_business_id);end if;
  if p_status is null then raise exception 'Queue status required' using errcode = '22023'; end if;
  if p_expected_revision is distinct from current_queue.revision then
    raise exception 'Queue changed; reload before saving' using errcode = '40001';
  end if;
  if current_queue.status = p_status then return p_queue_id; end if;
  update public.queues set status = p_status where id = p_queue_id;
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (p_business_id, 'queue_status_changed', actor_id,
      jsonb_build_object('queue_id', p_queue_id, 'from', current_queue.status, 'to', p_status));
  return p_queue_id;
end;
$$;
create or replace function public.create_unit_queue(
  p_queue_id uuid, p_business_id uuid, p_location_id uuid, p_name text,
  p_description text, p_average_service_seconds integer, p_warning_threshold integer,
  p_allow_phone boolean, p_require_phone boolean, p_unit_id uuid
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id text := private.current_clerk_user_id();
  existing_business uuid;
  queue_slug text;
begin
  if actor_id is null or not private.unit_permission(p_business_id,p_unit_id,'queue.create') then
    raise exception 'Queue management access required' using errcode = '42501';
  end if;
  if p_queue_id is null then raise exception 'Queue ID required' using errcode = '22023'; end if;
  -- The form carries a stable random queue ID: double submissions and retries
  -- after an ambiguous network failure create one queue and one audit event.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('queuezero:create:' || p_queue_id::text, 0));
  perform private.lock_unit_permission(p_business_id,p_unit_id,'queue.create');
  select business_id into existing_business from public.queues where id = p_queue_id;
  if found then
    if existing_business <> p_business_id or not exists(select 1 from public.queues where id=p_queue_id and unit_id=p_unit_id) then
      raise exception 'Queue unavailable' using errcode = '42501';
    end if;
    return p_queue_id;
  end if;
  perform private.validate_queue_settings(p_name, p_description, p_average_service_seconds, p_warning_threshold, p_allow_phone, p_require_phone);
  -- Lock against concurrent location deactivation while validating ownership.
  perform 1 from public.locations where id = p_location_id and business_id = p_business_id and is_active for share;
  if not found then raise exception 'Choose an active location in this business' using errcode = '22023'; end if;
  queue_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
  queue_slug := coalesce(nullif(rtrim(left(queue_slug, 60), '-'), ''), 'queue') || '-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.queues (id, business_id, location_id, name, slug, description, average_service_seconds, warning_threshold, allow_phone, require_phone, unit_id)
    values (p_queue_id, p_business_id, p_location_id, btrim(p_name), queue_slug, nullif(btrim(p_description), ''), p_average_service_seconds, p_warning_threshold, p_allow_phone, p_require_phone, p_unit_id);
  insert into public.business_events (business_id, type, actor_user_id, metadata)
    values (p_business_id, 'queue_created', actor_id, jsonb_build_object('queue_id', p_queue_id, 'location_id', p_location_id));
  return p_queue_id;
end;
$$;
create function private.require_queue_unit() returns trigger language plpgsql security definer set search_path='' as $$begin if exists(select 1 from public.businesses where id=new.business_id and institution_type is not null) and new.unit_id is null then select id into new.unit_id from public.organization_units where organization_id=new.business_id and slug='administration';if new.unit_id is null then raise exception 'Institution queue needs a unit' using errcode='22023';end if;end if;return new;end$$;
create trigger require_queue_unit before insert or update of unit_id on public.queues for each row execute function private.require_queue_unit();
create or replace function public.school_manage(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(p_payload->>'organization_id')::uuid; actor text:=private.current_clerk_user_id(); result_id uuid; course uuid; cls public.class_sessions%rowtype; s public.sessions%rowtype; item jsonb; person uuid; v_email text; profile public.school_profiles%rowtype;
begin
 perform 1 from public.businesses where id=org for share;
 if actor is null or not private.school_enabled(org) or octet_length(p_payload::text)>131072 then raise exception 'School unavailable' using errcode='42501';end if;
 if exists(select 1 from public.businesses where id=org and institution_type is not null) then
 if p_action='course' then perform private.lock_unit_permission(org,(select unit_id from public.departments where id=(p_payload->>'department_id')::uuid and organization_id=org),'course.create');
 elsif p_action in ('enroll','lecturer','remove_lecturer','class') then perform private.lock_institution_course((p_payload->>'course_id')::uuid,case when p_action='class' then 'attendance.start' else 'course.manage' end);
 elsif p_action in ('open','close_arrival','enable_checkout','finish') then perform private.lock_institution_course((select course_id from public.class_sessions where id=(p_payload->>'class_id')::uuid and organization_id=org),case when p_action='open' then 'attendance.start' else 'attendance.manage' end);
 elsif p_action='resolve_flag' then perform private.lock_institution_course((select c.course_id from public.class_sessions c join public.attendance_flags af on af.class_session_id=c.id where af.id=(p_payload->>'flag_id')::uuid and af.organization_id=org),'attendance.manage');
 end if;end if;
 if p_action in ('faculty','department','lecturer') then
  perform private.lock_business_manager(org);
  if not private.school_manager(org) then raise exception 'Not authorized' using errcode='42501';end if;
 end if;
 if p_action='faculty' then
  insert into public.faculties(organization_id,name) values(org,btrim(p_payload->>'name')) returning id into result_id;
 elsif p_action='department' then
  insert into public.departments(organization_id,faculty_id,name) values(org,(p_payload->>'faculty_id')::uuid,btrim(p_payload->>'name')) returning id into result_id;
 elsif p_action='course' then
  perform 1 from public.business_members where business_id=org and clerk_user_id=actor and (role in ('owner','admin','lecturer') or exists(select 1 from public.businesses where id=org and institution_type is not null)) for share;
  if not found then raise exception 'Not authorized' using errcode='42501';end if;
  insert into public.courses(organization_id,department_id,code,title,unit_id) values(org,(p_payload->>'department_id')::uuid,btrim(p_payload->>'code'),btrim(p_payload->>'title'),(select unit_id from public.departments where id=(p_payload->>'department_id')::uuid and organization_id=org)) returning id into result_id;
  if private.business_role_for(org)='lecturer' then
   insert into public.course_lecturers(organization_id,course_id,clerk_user_id,display_name) values(org,result_id,actor,btrim(p_payload->>'creator_display_name'));
  end if;
 elsif p_action='lecturer' then
  course:=(p_payload->>'course_id')::uuid;
  if not exists(select 1 from public.courses where id=course and organization_id=org) or p_payload->>'user_id' !~ '^user_[A-Za-z0-9]+$' then raise exception 'Invalid lecturer' using errcode='22023';end if;
  insert into public.business_members(business_id,clerk_user_id,role) values(org,p_payload->>'user_id','lecturer') on conflict(business_id,clerk_user_id) do nothing;
  if exists(select 1 from public.business_members where business_id=org and clerk_user_id=p_payload->>'user_id' and role not in ('owner','admin','lecturer')) then raise exception 'Choose an owner, administrator or lecturer account' using errcode='22023';end if;
  insert into public.course_lecturers(organization_id,course_id,clerk_user_id,display_name) values(org,course,p_payload->>'user_id',btrim(p_payload->>'display_name')) on conflict(course_id,clerk_user_id) do update set display_name=excluded.display_name;
 elsif p_action='remove_lecturer' then
  course:=(p_payload->>'course_id')::uuid;
  if private.school_lock_course(course) is distinct from org then raise exception 'Course unavailable' using errcode='42501';end if;
  perform private.lock_business_manager(org);
  delete from public.course_lecturers where course_id=course and organization_id=org and clerk_user_id=p_payload->>'user_id';
 elsif p_action in ('enroll','class') then
  course:=(p_payload->>'course_id')::uuid;
  if private.school_lock_course(course) is distinct from org then raise exception 'Course unavailable' using errcode='42501';end if;
  if p_action='enroll' then
   if jsonb_typeof(p_payload->'students') is distinct from 'array' or jsonb_array_length(p_payload->'students') not between 1 and 200 then raise exception 'Provide 1 to 200 students' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(p_payload->'students') loop
    v_email:=lower(btrim(item->>'email'));
    if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid enrollment email' using errcode='22023';end if;
    insert into public.people(organization_id,type,full_name,email) values(org,'STUDENT',btrim(item->>'full_name'),v_email) on conflict(organization_id,email) do nothing;
    select id into person from public.people where organization_id=org and people.email=v_email;
    select * into profile from public.school_profiles where id=person;
    if found and (profile.matric_number is distinct from btrim(item->>'matric_number') or profile.department_id is distinct from (item->>'department_id')::uuid) then raise exception 'Existing student identity does not match' using errcode='22023';end if;
    insert into public.school_profiles(id,organization_id,department_id,matric_number,level) values(person,org,(item->>'department_id')::uuid,btrim(item->>'matric_number'),btrim(item->>'level')) on conflict(id) do nothing;
    insert into public.course_students(organization_id,course_id,student_id) values(org,course,person) on conflict do nothing;
   end loop;
  else
   if (p_payload->>'starts_at')::timestamptz is null or not isfinite((p_payload->>'starts_at')::timestamptz) then raise exception 'Class start is required' using errcode='22023';end if;
   insert into public.sessions(organization_id,type,status,starts_at,created_by) values(org,'CLASS','DRAFT',(p_payload->>'starts_at')::timestamptz,actor) returning id into result_id;
   if p_payload->>'planned_ends_at' is not null and (not isfinite((p_payload->>'planned_ends_at')::timestamptz) or (p_payload->>'planned_ends_at')::timestamptz<=(p_payload->>'starts_at')::timestamptz) then raise exception 'Planned end must follow start' using errcode='22023';end if;
   insert into public.class_sessions(id,organization_id,course_id,late_after_minutes,departure_required,planned_ends_at) values(result_id,org,course,coalesce((p_payload->>'late_after_minutes')::integer,10),coalesce((p_payload->>'departure_required')::boolean,false),(p_payload->>'planned_ends_at')::timestamptz);
  end if;
 elsif p_action in ('open','close_arrival','enable_checkout','finish') then
  select * into cls from public.class_sessions where id=(p_payload->>'class_id')::uuid and organization_id=org;
  if not found or private.school_lock_course(cls.course_id) is distinct from org then raise exception 'Class unavailable' using errcode='42501';end if;
  select * into cls from public.class_sessions where id=cls.id for update;
  select * into s from public.sessions where id=cls.id for update;
  result_id:=cls.id;
  if p_action='open' then
   if s.status='OPEN' then return jsonb_build_object('id',result_id,'message','Attendance is open.');end if;
   if s.status<>'DRAFT' then raise exception 'Class cannot be reopened' using errcode='22023';end if;
   if not exists(select 1 from public.course_lecturers where course_id=cls.course_id) then raise exception 'Assign a lecturer before opening attendance' using errcode='22023';end if;
   insert into public.class_lecturers(organization_id,class_session_id,clerk_user_id,display_name) select org,cls.id,clerk_user_id,display_name from public.course_lecturers where course_id=cls.course_id;
   insert into public.class_roster(organization_id,class_session_id,student_id) select org,cls.id,student_id from public.course_students where course_id=cls.course_id;
   update public.class_sessions set arrival_open=true,opened_at=clock_timestamp() where id=cls.id;
   update public.sessions set status='OPEN',updated_at=clock_timestamp() where id=cls.id;
  else
   if s.status<>'OPEN' then raise exception 'Class is not open' using errcode='22023';end if;
   if p_action='close_arrival' then update public.class_sessions set arrival_open=false where id=cls.id;
   elsif p_action='enable_checkout' then update public.class_sessions set checkout_enabled=true where id=cls.id;
   else
    if clock_timestamp()<s.starts_at then raise exception 'Class cannot finish before its scheduled start' using errcode='22023';end if;
    insert into public.attendance_records(organization_id,class_session_id,student_id,status) select org,cls.id,r.student_id,'ABSENT' from public.class_roster r where r.class_session_id=cls.id on conflict(class_session_id,student_id) do nothing;
    if cls.departure_required then update public.attendance_records set status='INCOMPLETE',updated_at=clock_timestamp() where class_session_id=cls.id and check_in_at is not null and check_out_at is null;end if;
    update public.class_sessions set arrival_open=false,checkout_enabled=false where id=cls.id;
    update public.sessions set status='COMPLETED',ends_at=clock_timestamp(),updated_at=clock_timestamp() where id=cls.id;
   end if;
  end if;
 elsif p_action='resolve_flag' then
  select c.* into cls from public.class_sessions c join public.attendance_flags f on f.class_session_id=c.id where f.id=(p_payload->>'flag_id')::uuid and f.organization_id=org;
  if not found or private.school_lock_course(cls.course_id) is distinct from org then raise exception 'Flag unavailable' using errcode='42501';end if;
  if p_payload->>'resolution' is null or length(btrim(p_payload->>'resolution')) not between 1 and 500 then raise exception 'Resolution required' using errcode='22023';end if;
  update public.attendance_flags set resolution=btrim(p_payload->>'resolution'),resolved_by=actor,resolved_at=clock_timestamp() where id=(p_payload->>'flag_id')::uuid and resolved_at is null;
 else raise exception 'Unknown school action' using errcode='22023';end if;
 insert into public.business_events(business_id,type,actor_user_id,metadata) values(org,'school_'||p_action,actor,jsonb_strip_nulls(jsonb_build_object('id',result_id)));
 perform private.school_broadcast(org,case when p_action in ('open','close_arrival','enable_checkout','finish','resolve_flag') then cls.id else null end);
 return jsonb_strip_nulls(jsonb_build_object('id',result_id,'message','Saved.'));
end$$;
create or replace function public.school_issue_qr(p_class_id uuid,p_nonce uuid,p_expires_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare cls public.class_sessions%rowtype;org uuid;begin
 select * into cls from public.class_sessions where id=p_class_id;
 if not found then raise exception 'Class unavailable' using errcode='42501';end if;
 perform 1 from public.businesses where id=cls.organization_id for share;
 perform private.lock_institution_course(cls.course_id,'attendance.start');
 org:=private.school_lock_course(cls.course_id);
 select * into cls from public.class_sessions where id=p_class_id for update;
 if not exists(select 1 from public.sessions where id=p_class_id and status='OPEN') or not(cls.arrival_open or cls.checkout_enabled) then raise exception 'Attendance is closed' using errcode='22023';end if;
 if p_nonce is null or p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '45 seconds' then raise exception 'Invalid QR validity' using errcode='22023';end if;
 -- More than enough for a rotating display, bounded against authenticated abuse.
 if (select count(*) from public.attendance_qr_nonces where class_session_id=p_class_id and created_at>clock_timestamp()-interval '1 minute')>=12 then raise exception 'Please wait before refreshing the QR' using errcode='54000';end if;
 delete from public.attendance_qr_nonces where class_session_id=p_class_id and expires_at<clock_timestamp()-interval '5 minutes';
 insert into public.attendance_qr_nonces(nonce,organization_id,class_session_id,expires_at) values(p_nonce,org,p_class_id,p_expires_at);
 return jsonb_build_object('organization_id',org,'session_id',p_class_id,'expires_at',p_expires_at);
end$$;
create or replace function public.school_snapshot(p_organization_id uuid,p_course_id uuid default null,p_class_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; course_filter uuid:=p_course_id;
begin
 if not private.school_staff(p_organization_id) then raise exception 'School unavailable' using errcode='42501';end if;
 if p_class_id is not null then
  select course_id into course_filter from public.class_sessions where id=p_class_id and organization_id=p_organization_id;
  if course_filter is null or not private.school_class_access(p_class_id) or (p_course_id is not null and p_course_id<>course_filter) then raise exception 'Class unavailable' using errcode='42501';end if;
 end if;
 if course_filter is not null and not exists(select 1 from public.courses where id=course_filter and organization_id=p_organization_id and private.school_course_access(id)) then raise exception 'Course unavailable' using errcode='42501';end if;
 with allowed_courses as (select * from public.courses c where c.organization_id=p_organization_id and private.school_course_access(c.id) and (course_filter is null or c.id=course_filter)),
 allowed_classes as (select c.*,s.status,s.starts_at,s.ends_at from public.class_sessions c join public.sessions s on s.id=c.id where c.course_id in(select id from allowed_courses) and (p_class_id is null or c.id=p_class_id)),
 roster as (select e.course_id,e.student_id from public.course_students e where e.course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT'))
 union select c.course_id,r.student_id from public.class_roster r join allowed_classes c on c.id=r.class_session_id where p_class_id is not null)
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name,'mode',organization_mode,'timezone',timezone) from public.businesses where id=p_organization_id),
 'faculties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.faculties where organization_id=p_organization_id and (unit_id is null or private.unit_visible(organization_id,unit_id) or exists(select 1 from public.departments d where d.faculty_id=faculties.id and private.unit_visible(d.organization_id,d.unit_id)))),'[]'),
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'faculty_id',faculty_id,'name',name) order by name) from public.departments where organization_id=p_organization_id and (unit_id is null or private.unit_visible(organization_id,unit_id))),'[]'),
 'courses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'department_id',department_id,'code',code,'title',title) order by code) from allowed_courses),'[]'),
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'matric_number',sp.matric_number,'department_id',sp.department_id,'level',sp.level) order by p.full_name) from public.people p join public.school_profiles sp on sp.id=p.id where p.id in(select student_id from roster)),'[]'),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(r)) from roster r),'[]'),
 'lecturers',coalesce((select jsonb_agg(jsonb_build_object('course_id',l.course_id,'clerk_user_id',l.clerk_user_id,'display_name',l.display_name)) from (
 select course_id,clerk_user_id,display_name from public.course_lecturers where course_id in(select id from allowed_courses) and (p_class_id is null or exists(select 1 from public.sessions where id=p_class_id and status='DRAFT'))
 union all select c.course_id,l.clerk_user_id,l.display_name from public.class_lecturers l join allowed_classes c on c.id=l.class_session_id where p_class_id is not null) l),'[]'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'course_id',course_id,'status',status,'starts_at',starts_at,'ends_at',ends_at,'late_after_minutes',late_after_minutes,'checkout_enabled',checkout_enabled,'arrival_open',arrival_open,'departure_required',departure_required,'planned_ends_at',planned_ends_at) order by starts_at desc) from allowed_classes),'[]'),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'check_in_at',check_in_at,'check_out_at',check_out_at,'status',status,'flag_reason',flag_reason)) from public.attendance_records where class_session_id in(select id from allowed_classes)),'[]'),
 'flags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'class_session_id',class_session_id,'student_id',student_id,'reason',reason,'created_at',created_at,'resolved_at',resolved_at,'resolution',resolution)) from public.attendance_flags where class_session_id in(select id from allowed_classes)),'[]')
 ) into result;
 return result;
end$$;
create function public.institution_snapshot(p_organization_id uuid,p_unit_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if private.business_role_for(p_organization_id) is null or not exists(select 1 from public.businesses where id=p_organization_id and institution_type is not null) or (p_unit_id is not null and not private.unit_visible(p_organization_id,p_unit_id)) then raise exception 'Institution unavailable' using errcode='42501';end if;
 with units as (select u.* from public.organization_units u where u.organization_id=p_organization_id and private.unit_visible(p_organization_id,u.id) and (p_unit_id is null or u.id=p_unit_id) order by u.name limit 500),
 visible_queues as (select q.* from public.queues q where q.business_id=p_organization_id and q.unit_id in(select id from units) and private.can_access_queue(q.id)),
 visible_courses as (select c.* from public.courses c where c.organization_id=p_organization_id and c.unit_id in(select id from units) and private.school_course_access(c.id)),
 visible_classes as (select c.*,s.status from public.class_sessions c join public.sessions s on s.id=c.id where c.course_id in(select id from visible_courses))
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name,'institution_type',institution_type) from public.businesses where id=p_organization_id),
 'units',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('permissions',(select coalesce(jsonb_agg(p),'[]') from unnest(array['unit.manage','unit.staff.manage','queue.create','queue.manage','queue.serve','course.create','course.manage','attendance.start','attendance.manage','attendance.export','appointments.create','appointments.manage','reports.view']) p where private.unit_permission(p_organization_id,u.id,p)))) from units u),'[]'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)) from (select m.id,m.clerk_user_id,m.role from public.business_members m where m.business_id=p_organization_id and (private.institution_admin(p_organization_id) or exists(select 1 from public.unit_memberships a where a.member_id=m.id and a.unit_id in(select id from units) and private.unit_permission(p_organization_id,a.unit_id,'unit.staff.manage'))) order by m.created_at limit 1000) m),'[]'),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('unit_id',a.unit_id,'member_id',a.member_id,'role',a.role,'staff_title',a.staff_title,'permissions',a.permissions)) from public.unit_memberships a where a.unit_id in(select id from units) and (private.unit_permission(p_organization_id,a.unit_id,'unit.staff.manage') or a.member_id in(select id from public.business_members where business_id=p_organization_id and clerk_user_id=private.current_clerk_user_id()))),'[]'),
 'queues',coalesce((select jsonb_agg(to_jsonb(q)) from(select q.id,q.unit_id,q.name,q.slug,q.status,(select count(*) from public.tickets t where t.queue_id=q.id and t.status='waiting') as waiting,(select coalesce(avg(extract(epoch from t.called_at-t.joined_at)),0)::integer from public.tickets t where t.queue_id=q.id and t.called_at>clock_timestamp()-interval '7 days') as average_wait_seconds from visible_queues q order by q.name limit 500) q),'[]'),
 'courses',coalesce((select jsonb_agg(to_jsonb(c)) from(select id,unit_id,code,title from visible_courses order by code limit 500)c),'[]'),
 'invitations',coalesce((select jsonb_agg(to_jsonb(i)) from(select id,email,unit_id,role,case when revoked_at is not null then 'revoked' when accepted_at is not null then 'accepted' when expires_at<clock_timestamp() then 'expired' else 'pending' end as status,expires_at from public.institution_invitations where organization_id=p_organization_id and unit_id in(select id from units) and private.unit_permission(p_organization_id,unit_id,'unit.staff.manage') order by created_at desc limit 200) i),'[]'),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',id,'unit_id',unit_id,'name',name,'kind',kind,'queue_id',queue_id)) from public.institution_services where organization_id=p_organization_id and unit_id in(select id from units)),'[]'),
 'summary',jsonb_build_object('waiting',(select count(*) from public.tickets where queue_id in(select id from visible_queues) and status='waiting'),'active_queues',(select count(*) from visible_queues where status='open'),'classes_running',(select count(*) from visible_classes where status='OPEN'),'attendance_today',(select count(*) from public.attendance_records where class_session_id in(select id from visible_classes) and check_in_at>=date_trunc('day',clock_timestamp())),'units_active',(select count(*) from units where status='active'))
 ) into result;return result;end$$;

-- Tenant and unit policy boundaries also apply to legacy raw table reads.
drop policy faculties_read on public.faculties;
create policy faculties_read on public.faculties for select to authenticated using(private.school_staff(organization_id) and (unit_id is null or private.unit_visible(organization_id,unit_id) or exists(select 1 from public.departments d where d.faculty_id=faculties.id and private.unit_visible(d.organization_id,d.unit_id))));
drop policy departments_read on public.departments;
create policy departments_read on public.departments for select to authenticated using(private.school_staff(organization_id) and (unit_id is null or private.unit_visible(organization_id,unit_id)));
create function private.unit_broadcast() returns trigger language plpgsql security definer set search_path='' as $$declare unit uuid;begin
 unit:=case when tg_op='DELETE' then old.unit_id else new.unit_id end;
 if unit is not null and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then execute 'select realtime.send($1,$2,$3,true)' using '{"changed":true}'::jsonb,'changed','unit:'||unit;end if;
 return null;exception when others then raise warning 'Unit broadcast unavailable';return null;end$$;
create trigger institution_queue_changed after insert or update or delete on public.queues for each row execute function private.unit_broadcast();
create trigger institution_assignment_changed after insert or update or delete on public.unit_memberships for each row execute function private.unit_broadcast();
create or replace function public.queuezero_receive_topic(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select public.queuezero_receive_queue_topic(p_topic)
 or exists(select 1 from public.businesses b where p_topic='school:'||b.id::text and private.school_staff(b.id))
 or exists(select 1 from public.class_sessions c where p_topic='class:'||c.id::text and private.school_class_access(c.id))
 or exists(select 1 from public.organization_units u where p_topic='unit:'||u.id::text and private.unit_visible(u.organization_id,u.id));$$;
do $$declare t text;begin foreach t in array array['organization_units','unit_memberships','institution_invitations','institution_services','appointments'] loop execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;end$$;
grant select on public.organization_units,public.unit_memberships,public.institution_services,public.appointments to authenticated;
create policy unit_read on public.organization_units for select to authenticated using(private.unit_visible(organization_id,id));
create policy unit_members_read on public.unit_memberships for select to authenticated using(private.unit_permission(organization_id,unit_id,'unit.staff.manage') or member_id in(select id from public.business_members where clerk_user_id=private.current_clerk_user_id()));
create policy services_read on public.institution_services for select to authenticated using(private.unit_visible(organization_id,unit_id));
create policy appointments_read on public.appointments for select to authenticated using(private.unit_permission(organization_id,unit_id,'appointments.manage'));
-- Function grants are explicit; invitation token digests and delivery state have no table API exposure.
do $$declare f record;begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('institution_admin','unit_permission','unit_visible','lock_unit_permission','unit_tree_guard','validate_unit_grant','lock_institution_course','require_queue_unit','unit_broadcast')) or (n.nspname='public' and p.proname in ('institution_setup','onboard_institution','institution_has_permission','institution_manage','institution_invite','institution_invite_batch','institution_revoke_invitation','institution_accept_invitation','institution_claim_invitation_delivery','institution_finish_invitation_delivery','institution_snapshot','create_unit_queue')) loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);end loop;end$$;
grant execute on function private.institution_admin(uuid),private.unit_permission(uuid,uuid,text),private.unit_visible(uuid,uuid) to authenticated;
grant execute on function public.institution_setup(uuid,text),public.onboard_institution(text,text,text,text,text,text,public.organization_mode,text),public.institution_has_permission(uuid,uuid,text),public.institution_manage(text,jsonb),public.institution_invite(uuid,uuid,text,text,text,text[],text,uuid),public.institution_invite_batch(uuid,jsonb),public.institution_revoke_invitation(uuid),public.institution_snapshot(uuid,uuid),public.create_unit_queue(uuid,uuid,uuid,text,text,integer,integer,boolean,boolean,uuid) to authenticated;
grant execute on function public.institution_accept_invitation(text,text,text),public.institution_claim_invitation_delivery(integer),public.institution_finish_invitation_delivery(uuid,boolean,text) to service_role;
commit;
