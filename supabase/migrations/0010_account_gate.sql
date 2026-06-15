-- ngig.cloud — single-call account gate for middleware + sensitive actions
-- Run in Supabase → SQL Editor.
-- Returns the caller's block state, storage limits, and whether their session
-- still exists. Sign-out / block delete the session, so session_active = false
-- means "kick now" — reliable and instant, without depending on the token iat.

create or replace function public.account_gate(sid uuid)
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
    -- sid null (token without a session id) → can't check, don't kick.
    (sid is null or exists (
       select 1 from auth.sessions s
       where s.id = sid and s.user_id = auth.uid()
    )) as session_active
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Callers use their own user-scoped client (authenticated role).
revoke execute on function public.account_gate(uuid) from anon;
grant   execute on function public.account_gate(uuid) to authenticated;
