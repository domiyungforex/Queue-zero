begin;
-- Active-ticket aliases previously bypassed the network join limit and could
-- grow request history without allocating another ticket. Preserve exact replay.
create index queue_join_requests_customer_window
  on public.queue_join_requests(queue_id, customer_key, created_at);

create function private.bound_join_retry_records() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- join_public_queue already holds this lock; also serialize direct service inserts.
  perform 1 from public.queues where id=new.queue_id for update;
  if (select count(*) from public.queue_join_requests
      where queue_id=new.queue_id and customer_key=new.customer_key
        and created_at>clock_timestamp()-interval '10 minutes') >= 60 then
    raise exception 'Too many join requests; try later' using errcode='QZ005';
  end if;
  return new;
end $$;
revoke all on function private.bound_join_retry_records() from public,anon,authenticated,service_role;
create trigger bound_join_retry_records before insert on public.queue_join_requests
  for each row execute function private.bound_join_retry_records();
commit;
