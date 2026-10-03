begin;
-- Invalidation messages contain no rows, names, phones, metrics or credentials.
-- Clients always refetch through their authenticated RLS-protected endpoints.
create function private.publish_business_update() returns trigger
language plpgsql security definer set search_path='' as $$
declare business_id uuid; row_data jsonb;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 business_id:=case when tg_table_name='businesses' then (row_data->>'id')::uuid else (row_data->>'business_id')::uuid end;
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  execute 'select realtime.send($1,$2,$3,true)' using jsonb_build_object('changed',true),'changed','business:'||business_id;
 end if;
 return null;
exception when others then
 raise warning 'Business broadcast unavailable'; return null;
end $$;
revoke all on function private.publish_business_update() from public,anon,authenticated,service_role;

create trigger businesses_live after insert or update or delete on public.businesses
 for each row execute function private.publish_business_update();
create trigger locations_live after insert or update or delete on public.locations
 for each row execute function private.publish_business_update();
create trigger members_live after insert or update or delete on public.business_members
 for each row execute function private.publish_business_update();
create trigger assignments_live after insert or update or delete on public.queue_staff_assignments
 for each row execute function private.publish_business_update();
create trigger subscriptions_live after insert or update or delete on public.subscriptions
 for each row execute function private.publish_business_update();
create trigger queues_business_live after insert or update or delete on public.queues
 for each row execute function private.publish_business_update();

-- Queue/customer screens also reflect service edits and location availability.
create function private.publish_queue_details_update() returns trigger
language plpgsql security definer set search_path='' as $$
declare q record;
begin
 if tg_table_name='queues' then
  perform private.publish_queue_change(new.id);
 elsif tg_table_name='locations' then
  for q in select id from public.queues where location_id=new.id loop
   perform private.publish_queue_change(q.id);
  end loop;
 else
  for q in select id from public.queues where business_id=new.id loop
   perform private.publish_queue_change(q.id);
  end loop;
 end if;
 return null;
end $$;
revoke all on function private.publish_queue_details_update() from public,anon,authenticated,service_role;
create trigger queue_details_live after insert or update of name,description,location_id,average_service_seconds,warning_threshold,allow_phone,require_phone on public.queues
 for each row execute function private.publish_queue_details_update();
create trigger location_details_live after update of name,timezone,is_active on public.locations
 for each row execute function private.publish_queue_details_update();
create trigger business_details_live after update of name on public.businesses
 for each row execute function private.publish_queue_details_update();
commit;
