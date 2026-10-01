begin;

-- Public access is to this explicit projection, never to underlying tenant tables.
-- No listing operation or internal identifiers/customer fields are exposed.
create function public.get_public_queue(p_slug text)
returns table (
  slug text,
  business_name text,
  business_logo_url text,
  queue_name text,
  description text,
  location_name text,
  status public.queue_status,
  waiting_count bigint,
  estimated_wait_seconds bigint,
  has_serving_customer boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_slug is null or char_length(p_slug) not between 3 and 100
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then return; end if;

  return query
    select q.slug, b.name, b.logo_url, q.name, q.description, l.name, q.status,
      waiting.total,
      case when q.status = 'open' then waiting.total * q.average_service_seconds::bigint else null::bigint end,
      exists(select 1 from public.tickets serving where serving.queue_id = q.id and serving.status = 'serving')
    from public.queues q
    join public.businesses b on b.id = q.business_id
    join public.locations l on l.id = q.location_id and l.business_id = q.business_id and l.is_active
    cross join lateral (
      -- Include every active waiting ticket, including those joined before midnight.
      -- The existing tickets_waiting_order partial index covers this aggregate.
      select count(*) as total from public.tickets t where t.queue_id = q.id and t.status = 'waiting'
    ) waiting
    where q.slug = p_slug;
end;
$$;

revoke all on function public.get_public_queue(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_queue(text) to anon, authenticated;

-- No new table grants or RLS policies: anonymous raw reads/writes remain denied.
commit;
