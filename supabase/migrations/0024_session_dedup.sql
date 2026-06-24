-- ngig.cloud — collapse duplicate sessions per device PER APP.
--
-- Supabase ALWAYS creates a new auth.sessions row on signInWithPassword, so
-- logging in again from the same browser + IP would accumulate duplicate
-- sessions. After each login we keep the new session and delete the caller's
-- OTHER sessions whose REAL device (client IP + browser user-agent) AND app
-- (cloud / dashboard) match the new login — both recorded in login_audit.
--
-- The app dimension is essential: the cloud app and the admin dashboard run in
-- the same browser (same IP + user-agent), so without it, logging into one would
-- delete the other's session and bounce the user out. Matching on app too means
-- the two apps never touch each other; only a stale same-app session on the same
-- device is collapsed. A different IP, browser, or app stays a separate session.
--
-- Deleting from auth.sessions is the same mechanism revoke_my_session() uses.
-- login_audit (the audit history) is left untouched. Called server-side from
-- recordLogin() with the service-role client. Re-runnable. Run in Supabase.

alter table public.login_audit add column if not exists app text;

-- Drop any earlier signature before creating the current one (return/args may
-- have changed across iterations of this migration).
drop function if exists public.prune_duplicate_sessions(uuid, uuid, text, text);
drop function if exists public.prune_duplicate_sessions(uuid, uuid, text, text, text);

create function public.prune_duplicate_sessions(
  p_user_id    uuid,
  p_session_id uuid,
  p_ip         text,
  p_user_agent text,
  p_app        text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  -- Need to know which session is the new one, and which app, to dedup safely.
  if p_session_id is null or p_app is null then
    return 0;
  end if;

  delete from auth.sessions s
  where s.user_id = p_user_id
    and s.id <> p_session_id
    and exists (
      select 1
      from public.login_audit a
      where a.session_id = s.id
        and a.app        is not distinct from p_app
        and a.ip         is not distinct from p_ip
        and a.user_agent is not distinct from p_user_agent
    );

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.prune_duplicate_sessions(uuid, uuid, text, text, text)
  from anon, authenticated;
grant execute on function public.prune_duplicate_sessions(uuid, uuid, text, text, text)
  to service_role;
