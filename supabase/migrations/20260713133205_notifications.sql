-- In-app notifications: a per-user feed surfaced by the nav bell. Rows are
-- created server-side (service role) by whatever emits an event (invite
-- requests now; account/email/limit events, announcements, and AI suggestions
-- later). Each user reads and marks their own; realtime pushes new ones live.

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- A user reads and marks only their own notifications. Inserts come from the
-- service-role client (server), so there is no user insert policy.
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime so the bell updates live (RLS-scoped: a client only receives its own).
alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;
