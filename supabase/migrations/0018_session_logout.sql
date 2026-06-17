-- ngig.cloud — active sessions a user can revoke from their profile
-- Run in Supabase → SQL Editor.
--
-- auth.sessions holds the real, revocable sessions (one per device login). Its
-- user_agent is the SERVER's UA (login runs server-side), so we enrich each row
-- with the real browser UA + geo from login_audit, matched on IP. The current
-- session is flagged via the `session_id` claim in the caller's JWT so the UI
-- can label it and hide its logout button.

-- Link each login_audit row to the auth session it created, so a session can be
-- shown with the REAL client device/IP/geo (captured from the browser's request
-- headers at login). Matching by IP is unreliable: server-side login means
-- auth.sessions.ip is the Vercel IP, not the client's.
alter table public.login_audit add column if not exists session_id uuid;
create index if not exists login_audit_session_idx on public.login_audit (session_id);

-- 0015 created my_sessions() with a different return shape; Postgres can't change
-- a function's return type via CREATE OR REPLACE, so drop it first.
drop function if exists public.my_sessions();

create or replace function public.my_sessions()
returns table (
  id         uuid,
  created_at timestamptz,
  last_seen  timestamptz,
  user_agent text,
  ip         text,
  city       text,
  country    text,
  is_current boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at, s.updated_at, s.created_at) as last_seen,
    coalesce(la.user_agent, s.user_agent)                as user_agent,
    coalesce(la.ip, host(s.ip))                          as ip,
    la.city,
    la.country,
    s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid as is_current
  from auth.sessions s
  -- The login_audit row stamped with THIS session's id holds the real client
  -- device/IP/geo (browser request headers at login).
  left join lateral (
    select a.user_agent, a.ip, a.city, a.country
    from public.login_audit a
    where a.session_id = s.id
    order by a.created_at desc
    limit 1
  ) la on true
  where s.user_id = auth.uid()
  order by is_current desc, last_seen desc;
$$;

revoke execute on function public.my_sessions() from anon;
grant   execute on function public.my_sessions() to authenticated;

-- Revoke one of MY sessions (never the current one — that path is the navbar
-- logout). Scoped to auth.uid() so a user can only kill their own sessions.
create or replace function public.revoke_my_session(sid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions
  where id = sid
    and user_id = auth.uid()
    and id is distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

revoke execute on function public.revoke_my_session(uuid) from anon;
grant   execute on function public.revoke_my_session(uuid) to authenticated;

-- Revoke ALL my other sessions, keeping only the current one.
create or replace function public.revoke_my_other_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions
  where user_id = auth.uid()
    and id is distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

revoke execute on function public.revoke_my_other_sessions() from anon;
grant   execute on function public.revoke_my_other_sessions() to authenticated;

-- Make session revocation INSTANT, not just on token expiry. The 0011 gate only
-- checked "does the user have ANY session", so revoking ONE session left the
-- revoked device passing the gate (the user still had others). Check the CALLER's
-- OWN session instead: if its id is gone from auth.sessions, kick on the next GET
-- (same mechanism as the dashboard force sign-out). Falls back to the any-session
-- check when the token carries no session_id claim.
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
    case
      when nullif(auth.jwt() ->> 'session_id', '') is not null then
        exists (
          select 1 from auth.sessions s
          where s.id = (auth.jwt() ->> 'session_id')::uuid
            and s.user_id = auth.uid()
        )
      else
        exists (select 1 from auth.sessions s where s.user_id = auth.uid())
    end as session_active
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.account_gate() from anon;
grant   execute on function public.account_gate() to authenticated;
