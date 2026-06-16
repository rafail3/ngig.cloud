-- ngig.cloud — login devices for the profile page
-- Run in Supabase → SQL Editor.
-- auth.sessions.user_agent is the SERVER's UA (login runs server-side), so it's
-- useless for device detection. login_audit captures the real browser UA + geo.
-- Deduped by (user_agent, ip) → one row per distinct device, latest first.

create or replace function public.my_login_devices()
returns table (
  user_agent text,
  ip         text,
  city       text,
  country    text,
  last_seen  timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    user_agent,
    ip,
    (array_agg(city    order by created_at desc))[1] as city,
    (array_agg(country order by created_at desc))[1] as country,
    max(created_at) as last_seen
  from public.login_audit
  where user_id = auth.uid()
  group by user_agent, ip
  order by last_seen desc
  limit 20;
$$;

revoke execute on function public.my_login_devices() from anon;
grant   execute on function public.my_login_devices() to authenticated;
