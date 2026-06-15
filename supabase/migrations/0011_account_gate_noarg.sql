-- ngig.cloud — account gate without the session_id claim dependency
-- Run in Supabase → SQL Editor.
-- The previous version took the token's session_id; if that claim was absent
-- the gate failed open. This checks whether the user has ANY active session.
-- Sign-out / block delete all of a user's sessions, so "no session" = kick.

drop function if exists public.account_gate(uuid);

create or replace function public.account_gate()
returns table (
  blocked_until  timestamptz,
  max_file_size  bigint,
  max_total_size bigint,
  session_active boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.blocked_until,
    p.max_file_size,
    p.max_total_size,
    exists (select 1 from auth.sessions s where s.user_id = auth.uid()) as session_active
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.account_gate() from anon;
grant   execute on function public.account_gate() to authenticated;
