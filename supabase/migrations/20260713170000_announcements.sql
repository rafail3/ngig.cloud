-- Broadcast announcements: an admin composes one (title, message, optional
-- link) and it fans out as a notification to every other account. This table is
-- the admin-side history; delivery reuses the notifications table.

create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  link            text,
  created_by      uuid references auth.users (id) on delete set null,
  recipient_count integer not null default 0,
  created_at      timestamptz not null default now()
);

create index announcements_created_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

-- Admin-only history (mirrors invite_requests). Writes go through the
-- service-role client; this policy is defense-in-depth for any user-scoped read.
create policy announcements_admin_all on public.announcements
  for all
  using (is_admin())
  with check (is_admin());

-- Live history updates for other admin sessions.
alter publication supabase_realtime add table public.announcements;
alter table public.announcements replica identity full;

-- Link each broadcast notification back to its announcement, so deleting the
-- announcement cascades — recalling every notification it created.
alter table public.notifications
  add column announcement_id uuid references public.announcements (id) on delete cascade;
