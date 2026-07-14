-- Private per-user behavior engine ("ngig Insights"). Two tables, both strictly
-- owner-scoped: there is NO admin policy, so every user (admins included) can
-- only ever read their own rows. The insights are computed from these + the
-- user's own files, entirely in the user's session context.

-- Lightweight behavior log: a few high-signal actions (upload/download/preview/
-- search). meta holds small, non-sensitive details (ext, size bucket, etc.).
create table public.user_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index user_events_user_created_idx on public.user_events (user_id, created_at desc);

alter table public.user_events enable row level security;
-- Owner-only: the user reads + logs only their own events. No admin access.
create policy user_events_select_own on public.user_events
  for select using (auth.uid() = user_id);
create policy user_events_insert_own on public.user_events
  for insert with check (auth.uid() = user_id);

-- Cached computed profile (recomputed on demand, ~hourly). One row per user.
create table public.user_insights (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  profile     jsonb not null,
  computed_at timestamptz not null default now()
);

alter table public.user_insights enable row level security;
-- Owner-only for everything: the engine (running as the user) reads + upserts
-- the user's own profile; nobody else — not even an admin — can read it.
create policy user_insights_all_own on public.user_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
