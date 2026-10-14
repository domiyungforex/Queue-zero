-- TEST-ONLY shim for vanilla PostgreSQL. Never apply this file to Supabase:
-- hosted/local Supabase already owns these roles and auth.jwt().
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;
-- Reproduce Supabase's broad default grants so migrations must remove them.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Reproduce the reported shared-schema security-advisor finding. The final
-- application migration must contain it without deleting or rewriting data.
create table public."Conversation" (id integer primary key, body text);
insert into public."Conversation" values (1, 'shared fixture');
grant all on public."Conversation" to public, anon, authenticated, service_role;

-- Capture Broadcast calls in the isolated PostgreSQL harness. This records
-- transport envelopes only and is never installed in the application database.
create schema realtime;
create table realtime.test_broadcasts(payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb,event text,topic text,private boolean default true)
returns void language sql as $$
 insert into realtime.test_broadcasts values(payload,event,topic,private);
$$;
