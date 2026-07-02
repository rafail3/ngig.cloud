-- ngig.cloud — let a user see their own active login sessions
-- Run in Supabase → SQL Editor.
-- Reads auth.sessions for the caller only (auth.uid()). host() strips the
-- inet netmask so the IP shows clean (1.2.3.4).

create or replace function public.my_sessions()
returns table (
  id         uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip         text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id,
    s.created_at,
    s.updated_at,
    s.user_agent,
    host(s.ip) as ip
  from auth.sessions s
  where s.user_id = auth.uid()
  order by coalesce(s.updated_at, s.created_at) desc;
$$;

revoke execute on function public.my_sessions() from anon;
grant   execute on function public.my_sessions() to authenticated;
