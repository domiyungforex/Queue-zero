begin;
create table public.site_inquiries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  name text not null check (length(name) between 1 and 100),
  email text not null check (length(email) between 3 and 254),
  message text not null check (length(message) between 10 and 4000),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
create index site_inquiries_source_created on public.site_inquiries (source_hash, created_at);
alter table public.site_inquiries enable row level security;
alter table public.site_inquiries force row level security;
revoke all on public.site_inquiries from public, anon, authenticated, service_role;
create function public.submit_site_inquiry(p_name text,p_email text,p_message text,p_source_hash text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid; previous public.site_inquiries%rowtype;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 100 or p_email is null or length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_message is null or length(trim(p_message)) not between 10 and 4000 or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' or p_request_id is null then raise exception 'Invalid inquiry' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('site-inquiry:' || p_source_hash, 0));
  select * into previous from public.site_inquiries where request_id=p_request_id;
  if found then
    if previous.source_hash <> p_source_hash or previous.email <> lower(p_email) or previous.name <> trim(p_name) or previous.message <> trim(p_message) then raise exception 'Invalid retry' using errcode='22023'; end if;
    return previous.id;
  end if;
  if (select count(*) from public.site_inquiries where source_hash=p_source_hash and created_at>clock_timestamp()-interval '1 hour') >= 5 then raise exception 'Too many inquiries. Try again later.' using errcode='P0001'; end if;
  insert into public.site_inquiries(request_id,name,email,message,source_hash) values(p_request_id,trim(p_name),lower(p_email),trim(p_message),p_source_hash) returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.submit_site_inquiry(text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_site_inquiry(text,text,text,text,uuid) to service_role;
commit;
