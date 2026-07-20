-- ngig.cloud — egress accounting for the admin cost calculator.
-- Run in Supabase → SQL Editor.
--
-- Deliberately SEPARATE from public.user_events (the private "ngig Insights"
-- log): insights are strictly owner-only (no admin can read them), but egress
-- is an OPERATOR metric — admins must read every user's bytes to compute the
-- per-user + platform bandwidth cost. Keeping them apart preserves the insights
-- privacy wall while still giving the cost dashboard real data.
--
-- One narrow row is written per file served to a user (a download, an inline
-- preview, a folder-zip, or an OnlyOffice open). The write is best-effort and
-- runs after the response (never on the hot path), so it adds no latency.

create table if not exists public.egress_events (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  bytes      bigint not null,
  source     text   not null,        -- 'download' | 'preview' | 'folder' | 'office'
  created_at timestamptz not null default now()
);

create index if not exists egress_events_created_idx
  on public.egress_events (created_at desc);
create index if not exists egress_events_user_created_idx
  on public.egress_events (user_id, created_at desc);

alter table public.egress_events enable row level security;

-- The user records their own egress rows (server-side, in their session). The
-- service-role paths (OnlyOffice open, which has no session) bypass RLS.
drop policy if exists egress_events_insert_own on public.egress_events;
create policy egress_events_insert_own on public.egress_events
  for insert with check (auth.uid() = user_id);

-- Only admins can read egress. It is not a user-facing metric.
drop policy if exists egress_events_admin_select on public.egress_events;
create policy egress_events_admin_select on public.egress_events
  for select using (public.is_admin());

-- =====================================================================
-- Aggregate helper: bytes egressed per user within a period. security
-- definer so it reads across all users; called by the service key from the
-- admin cost layer. Revoked from anon/authenticated (operator-only).
-- =====================================================================
create or replace function public.admin_egress_by_user(from_ts timestamptz, to_ts timestamptz)
returns table (user_id uuid, bytes bigint)
language sql security definer stable set search_path = public
as $$
  select e.user_id, coalesce(sum(e.bytes), 0)::bigint
  from public.egress_events e
  where e.created_at >= from_ts and e.created_at < to_ts
  group by e.user_id;
$$;

revoke execute on function public.admin_egress_by_user(timestamptz, timestamptz)
  from anon, authenticated;
