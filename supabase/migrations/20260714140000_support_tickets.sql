-- Support tickets: users open tickets from the cloud, admins handle them from
-- the dashboard. A ticket is a thread of messages (user + admin) with optional
-- file attachments. Status is a simple open/closed toggle.

-- ── Tickets ────────────────────────────────────────────────────────────────
create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  subject         text not null,
  category        text not null,
  -- low | medium | high
  priority        text not null default 'medium'
                    check (priority in ('low', 'medium', 'high')),
  -- open | closed
  status          text not null default 'open'
                    check (status in ('open', 'closed')),
  created_at      timestamptz not null default now(),
  -- Bumped on every new message / status change → sort the list by real activity.
  last_activity_at timestamptz not null default now(),
  closed_at       timestamptz
);

create index if not exists tickets_user_idx
  on public.tickets (user_id, last_activity_at desc);
create index if not exists tickets_status_idx
  on public.tickets (status, last_activity_at desc);

-- ── Messages ───────────────────────────────────────────────────────────────
create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid not null references auth.users (id) on delete cascade,
  -- Denormalised so the thread renders sides without joining profiles/role.
  from_admin  boolean not null default false,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_idx
  on public.ticket_messages (ticket_id, created_at);

-- ── Attachments ────────────────────────────────────────────────────────────
create table if not exists public.ticket_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.ticket_messages (id) on delete cascade,
  name        text not null,
  size        bigint not null,
  mime_type   text,
  storage_key text not null,
  created_at  timestamptz not null default now()
);

create index if not exists ticket_attachments_message_idx
  on public.ticket_attachments (message_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.tickets            enable row level security;
alter table public.ticket_messages    enable row level security;
alter table public.ticket_attachments enable row level security;

-- Tickets: owner reads/creates own; admin does everything. Status changes and
-- activity bumps are made server-side (service role), so no owner UPDATE policy.
create policy tickets_owner_select on public.tickets
  for select using (user_id = auth.uid());
create policy tickets_owner_insert on public.tickets
  for insert with check (user_id = auth.uid());
create policy tickets_admin_all on public.tickets
  for all using (is_admin()) with check (is_admin());

-- Messages: visible to the ticket owner and to admins. The owner may post on
-- their own ticket; admins may post on any. from_admin is enforced by the
-- server (service role), not trusted from the client insert.
create policy ticket_messages_select on public.ticket_messages
  for select using (
    is_admin()
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );
create policy ticket_messages_owner_insert on public.ticket_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );
create policy ticket_messages_admin_all on public.ticket_messages
  for all using (is_admin()) with check (is_admin());

-- Attachments: follow their message's visibility.
create policy ticket_attachments_select on public.ticket_attachments
  for select using (
    is_admin()
    or exists (
      select 1
      from public.ticket_messages m
      join public.tickets t on t.id = m.ticket_id
      where m.id = message_id and t.user_id = auth.uid()
    )
  );
create policy ticket_attachments_owner_insert on public.ticket_attachments
  for insert with check (
    exists (
      select 1
      from public.ticket_messages m
      join public.tickets t on t.id = m.ticket_id
      where m.id = message_id and t.user_id = auth.uid()
    )
  );
create policy ticket_attachments_admin_all on public.ticket_attachments
  for all using (is_admin()) with check (is_admin());

-- ── Realtime ───────────────────────────────────────────────────────────────
-- Live updates for both the user's ticket view and the admin dashboard.
alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.ticket_messages;
alter table public.tickets            replica identity full;
alter table public.ticket_messages    replica identity full;
