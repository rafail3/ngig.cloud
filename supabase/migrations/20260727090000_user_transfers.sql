-- ngig.cloud — user-to-user file/folder transfers ("Trimite utilizator" tab).
-- A sender picks one or more of their own files/folders and a recipient; the
-- recipient must ACCEPT (picking a destination folder) or DECLINE before
-- anything moves. Unaccepted requests expire after 7 days.
--
-- Cross-user work (reading the sender's items to copy/move them, transitioning
-- status) runs through the service-role client with app-level authorization
-- checks — the same pattern already used for account wipes and admin actions —
-- because RLS can't express "the recipient may act on the sender's rows".
-- Creating a request stays on the sender's own RLS session (mirrors
-- share_links: ownership is enforced by the normal owner-scoped read+insert).
-- Run in Supabase → SQL Editor (or `npm run db:push`).

create table if not exists public.transfers (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  mode         text not null check (mode in ('copy', 'move')),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint transfers_not_to_self check (sender_id <> recipient_id)
);

create table if not exists public.transfer_items (
  id          uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers (id) on delete cascade,
  file_id     uuid references public.files (id)   on delete cascade,
  folder_id   uuid references public.folders (id) on delete cascade,

  constraint transfer_items_one_target check (
    (file_id is not null and folder_id is null) or
    (folder_id is not null and file_id is null)
  )
);

create index if not exists transfers_sender_idx    on public.transfers (sender_id, created_at desc);
create index if not exists transfers_recipient_idx on public.transfers (recipient_id, created_at desc);
create index if not exists transfers_expires_idx   on public.transfers (expires_at) where status = 'pending';
create index if not exists transfer_items_transfer_idx on public.transfer_items (transfer_id);

alter table public.transfers      enable row level security;
alter table public.transfer_items enable row level security;

-- Both parties can see a transfer; only the sender can create one (app code
-- ownership-checks every item against the sender's own files/folders before
-- insert, the same way share links do).
create policy "transfers: sender or recipient can read"
  on public.transfers for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "transfers: sender can create"
  on public.transfers for insert
  with check (auth.uid() = sender_id);

-- No client-side update/delete policy: accept / decline / cancel / expire are
-- state transitions with cross-user side effects (copying or moving another
-- user's files) and go through the service-role client with explicit
-- sender/recipient checks in application code.

create policy "transfer_items: sender or recipient can read"
  on public.transfer_items for select
  using (
    exists (
      select 1 from public.transfers t
      where t.id = transfer_id
        and (auth.uid() = t.sender_id or auth.uid() = t.recipient_id)
    )
  );

create policy "transfer_items: sender can attach items to own transfer"
  on public.transfer_items for insert
  with check (
    exists (
      select 1 from public.transfers t
      where t.id = transfer_id and t.sender_id = auth.uid()
    )
  );

-- Realtime: the "Transferuri" page (Primite/Trimise) reflects new requests and
-- accept/decline/cancel instantly for both parties.
alter table public.transfers replica identity full;
alter publication supabase_realtime add table public.transfers;

-- Live username search for the "Trimite utilizator" picker. profiles RLS only
-- allows reading your own row (or all rows if admin), so a regular user can't
-- search other usernames directly — this SECURITY DEFINER function exposes
-- exactly id+username, nothing else, capped and excluding the caller.
create or replace function public.search_users(q text)
returns table (id uuid, username text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.id <> auth.uid()
    and length(q) >= 2
    and p.username ilike '%' || q || '%'
  order by p.username
  limit 8;
$$;

revoke execute on function public.search_users(text) from anon;
grant  execute on function public.search_users(text) to authenticated;
