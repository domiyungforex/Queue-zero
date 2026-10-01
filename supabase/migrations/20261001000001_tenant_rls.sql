begin;

-- Supabase verifies Clerk's signature/issuer before assigning authenticated.
-- Clerk subjects are TEXT (user_...), so auth.uid()'s UUID cast is inappropriate.
create function private.current_clerk_user_id() returns text
language sql stable set search_path = '' as $$
  select case when (select auth.jwt() ->> 'role') = 'authenticated'
    then nullif((select auth.jwt() ->> 'sub'), '') else null end;
$$;

-- Narrow, read-only SECURITY DEFINER helpers avoid recursive membership RLS.
-- No caller-supplied user ID, dynamic SQL, or caller-controlled search_path.
create function private.business_role_for(target_business_id uuid) returns public.business_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.business_members m
  where m.business_id = target_business_id
    and m.clerk_user_id = (select private.current_clerk_user_id());
$$;

create function private.can_access_queue(target_queue_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.queues q
    join public.business_members m on m.business_id = q.business_id
    where q.id = target_queue_id
      and m.clerk_user_id = (select private.current_clerk_user_id())
      and (
        m.role in ('owner', 'admin') or exists (
          select 1 from public.queue_staff_assignments a
          where a.queue_id = q.id and a.business_member_id = m.id
        )
      )
  );
$$;

create function private.can_manage_queue(target_queue_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.queues q
    where q.id = target_queue_id
      and private.business_role_for(q.business_id) in ('owner', 'admin')
  );
$$;

revoke all on function private.current_clerk_user_id() from public, anon, authenticated;
revoke all on function private.business_role_for(uuid) from public, anon, authenticated;
revoke all on function private.can_access_queue(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_queue(uuid) from public, anon, authenticated;
grant execute on function private.current_clerk_user_id() to authenticated;
grant execute on function private.business_role_for(uuid) to authenticated;
grant execute on function private.can_access_queue(uuid) to authenticated;
grant execute on function private.can_manage_queue(uuid) to authenticated;

create policy businesses_member_read on public.businesses for select to authenticated
  using (private.business_role_for(id) is not null);

create policy members_manager_or_self_read on public.business_members for select to authenticated
  using (clerk_user_id = (select private.current_clerk_user_id())
    or private.business_role_for(business_id) in ('owner', 'admin'));

create policy locations_member_read on public.locations for select to authenticated
  using (private.business_role_for(business_id) is not null);

create policy queues_authorized_read on public.queues for select to authenticated
  using (private.can_access_queue(id));

create policy assignments_manager_or_self_read on public.queue_staff_assignments for select to authenticated
  using (private.business_role_for(business_id) in ('owner', 'admin')
    or business_member_id in (
      select m.id from public.business_members m
      where m.clerk_user_id = (select private.current_clerk_user_id())
    ));

create policy tickets_queue_read on public.tickets for select to authenticated
  using (private.can_access_queue(queue_id));

create policy ticket_events_queue_read on public.ticket_events for select to authenticated
  using (private.can_access_queue(queue_id));

-- Ticket push endpoints/keys are private even to business staff.
create policy push_subscriptions_self_read on public.push_subscriptions for select to authenticated
  using (clerk_user_id = (select private.current_clerk_user_id()));

create policy notifications_manager_read on public.notifications for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id and private.can_manage_queue(t.queue_id)
  ));

create policy subscriptions_owner_read on public.subscriptions for select to authenticated
  using (private.business_role_for(business_id) = 'owner');

-- No direct mutation grants or policies. Counter allocation, ticket transitions,
-- onboarding, membership changes, and payments require dedicated authorized RPCs.
-- Raw webhooks and daily counters deliberately have no client read access either.
grant select on public.businesses, public.business_members, public.locations,
  public.queues, public.queue_staff_assignments, public.tickets,
  public.ticket_events, public.push_subscriptions, public.notifications,
  public.subscriptions to authenticated;

commit;
