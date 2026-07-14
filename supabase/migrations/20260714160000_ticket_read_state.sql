-- Read state for support tickets + the denormalised fields the unread checks
-- need, so "is this unread?" is one indexed read instead of scanning messages.

-- Who sent the LAST message on a ticket. Unread = the last word came from the
-- other side, after you last looked. Chat apps work the same way: if you
-- replied, you obviously read what came before.
alter table public.tickets
  add column if not exists last_message_from_admin boolean not null default false;

-- Backfill from the real thread so existing tickets aren't wrong on day one.
update public.tickets t
set last_message_from_admin = coalesce(m.from_admin, false)
from (
  select distinct on (ticket_id) ticket_id, from_admin
  from public.ticket_messages
  order by ticket_id, created_at desc
) m
where m.ticket_id = t.id;

-- ── Per-thread read state ──────────────────────────────────────────────────
-- One row per (ticket, viewer): when that person last opened the thread.
-- Drives the "unread" dot for the user and the "nou" row for admins.
create table if not exists public.ticket_views (
  ticket_id    uuid not null references public.tickets (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

-- ── Inbox read state ───────────────────────────────────────────────────────
-- When an admin last looked at the ticket LIST. Drives the nav badge, which
-- clears on visiting the list — separate from per-thread read state, so rows
-- stay marked "nou" until actually opened.
create table if not exists public.ticket_inbox_views (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Read state is private to its owner. Writes go through the server (service
-- role) on render, so no INSERT/UPDATE policy is needed.
alter table public.ticket_views       enable row level security;
alter table public.ticket_inbox_views enable row level security;

create policy ticket_views_own on public.ticket_views
  for select using (user_id = auth.uid());
create policy ticket_inbox_views_own on public.ticket_inbox_views
  for select using (user_id = auth.uid());
