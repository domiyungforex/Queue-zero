begin;
create table public.billing_checkouts (
 reference uuid primary key, business_id uuid not null references public.businesses(id),
 plan public.subscription_plan not null check(plan<>'FREE'), provider_plan_code text not null,
 amount bigint not null check(amount>0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 status text not null default 'pending' check(status in ('pending','paid','failed')),
 created_at timestamptz not null default now(), verified_at timestamptz
);
alter table public.billing_checkouts enable row level security;
alter table public.billing_checkouts force row level security;
revoke all on public.billing_checkouts from public,anon,authenticated,service_role;
grant select on public.billing_checkouts to authenticated;
grant select,insert,update on public.billing_checkouts to service_role;
create policy checkout_owner on public.billing_checkouts for select to authenticated using(private.business_role_for(business_id)='owner');
create index billing_checkout_business on public.billing_checkouts(business_id,created_at desc);
alter table public.subscriptions add column provider_plan_code text;
alter table public.subscriptions add column last_event_at timestamptz;
create index subscriptions_customer on public.subscriptions(provider_customer_code);

create function public.confirm_checkout(p_reference uuid,p_event_id text,p_customer_code text,p_subscription_code text,p_paid_at timestamptz,p_period_end timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare c public.billing_checkouts;
begin
 select * into c from public.billing_checkouts where reference=p_reference for update;
 if not found or p_customer_code is null or p_paid_at is null then raise exception 'Checkout unavailable' using errcode='22023'; end if;
 perform 1 from public.businesses where id=c.business_id for update;
 insert into public.webhook_events(provider,provider_event_id,event_type,payload,processed_at) values('paystack',p_event_id,'charge.success',jsonb_build_object('reference',p_reference),now()) on conflict do nothing;
 if not found then return;end if;
 update public.billing_checkouts set status='paid',verified_at=now() where reference=c.reference;
 insert into public.subscriptions(business_id,plan,status,provider_customer_code,provider_subscription_code,provider_plan_code,current_period_end,last_event_at)
 values(c.business_id,c.plan,'active',p_customer_code,nullif(p_subscription_code,''),c.provider_plan_code,p_period_end,p_paid_at)
 on conflict(business_id) do update set plan=excluded.plan,status='active',provider_customer_code=excluded.provider_customer_code,provider_subscription_code=case when public.subscriptions.provider_plan_code=excluded.provider_plan_code then coalesce(excluded.provider_subscription_code,public.subscriptions.provider_subscription_code) else excluded.provider_subscription_code end,provider_plan_code=excluded.provider_plan_code,current_period_end=excluded.current_period_end,last_event_at=excluded.last_event_at
 where public.subscriptions.last_event_at is null or excluded.last_event_at>=public.subscriptions.last_event_at;
 if found then update public.businesses set subscription_tier=c.plan where id=c.business_id;end if;
end $$;
revoke all on function public.confirm_checkout(uuid,text,text,text,timestamptz,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.confirm_checkout(uuid,text,text,text,timestamptz,timestamptz) to service_role;

create function public.sync_subscription_event(p_event_id text,p_event_type text,p_customer_code text,p_subscription_code text,p_plan_code text,p_status public.subscription_status,p_event_at timestamptz,p_period_end timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;
begin
 if p_status is null or p_status not in ('active','past_due','cancelled','expired') or p_event_at is null then raise exception 'Invalid subscription event' using errcode='22023';end if;
 select * into s from public.subscriptions where provider_subscription_code=p_subscription_code and provider_customer_code=p_customer_code and provider_plan_code=p_plan_code for update;
 if not found then
  if (select count(*) from public.subscriptions where provider_customer_code=p_customer_code and provider_plan_code=p_plan_code and provider_subscription_code is null)<>1 then raise exception 'Ambiguous subscription mapping' using errcode='P0002';end if;
  select * into s from public.subscriptions where provider_customer_code=p_customer_code and provider_plan_code=p_plan_code and provider_subscription_code is null for update;
 end if;
 if not found then raise exception 'Subscription mapping pending' using errcode='P0002';end if;
 insert into public.webhook_events(provider,provider_event_id,event_type,payload,processed_at) values('paystack',p_event_id,p_event_type,jsonb_build_object('subscription',p_subscription_code),now()) on conflict do nothing;
 if not found then return;end if;
 if s.last_event_at is not null and p_event_at<s.last_event_at then return;end if;
 update public.subscriptions set provider_subscription_code=p_subscription_code,status=p_status,current_period_end=coalesce(p_period_end,current_period_end),last_event_at=p_event_at where id=s.id;
 update public.businesses set subscription_tier=case when p_status='active' then s.plan else 'FREE'::public.subscription_plan end where id=s.business_id;
end $$;
revoke all on function public.sync_subscription_event(text,text,text,text,text,public.subscription_status,timestamptz,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.sync_subscription_event(text,text,text,text,text,public.subscription_status,timestamptz,timestamptz) to service_role;

create function private.enforce_queue_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare tier public.subscription_plan; maximum integer;
begin
 -- Shared lock key serializes simultaneous queue creation for this business.
 perform pg_advisory_xact_lock(hashtextextended(new.business_id::text,41));
 select subscription_tier into tier from public.businesses where id=new.business_id;
 if exists(select 1 from public.subscriptions where business_id=new.business_id and (status<>'active' or current_period_end<=now())) then tier:='FREE';end if;
 maximum:=case tier when 'BUSINESS' then 50 when 'STARTER' then 10 else 3 end;
 if not exists(select 1 from public.queues where id=new.id) and (select count(*) from public.queues where business_id=new.business_id)>=maximum then raise exception 'Queue limit reached. Upgrade your plan.' using errcode='QZ009';end if;
 return new;
end $$;
revoke all on function private.enforce_queue_plan() from public,anon,authenticated,service_role;
-- Limits are applied to new queues only. Existing queues are never removed on downgrade.
create trigger queues_plan_limit before insert on public.queues for each row execute function private.enforce_queue_plan();
commit;
