-- ngig.cloud — public share links (Faza A).
-- A share link exposes ONE file or folder to anyone holding a random,
-- unguessable token, with no account required. The token lives in the URL
-- (/s/<token>); the row here holds ownership, target + expiry. The underlying
-- file/folder is never modified by sharing — revoking or expiring a link only
-- deletes this row, never the user's data.
--
-- The public share page has no session, so token resolution + the access-count
-- bump run through the service-role (admin) client in the app, bypassing RLS by
-- design. RLS below only governs the OWNER managing their own links while
-- authenticated ("Linkurile mele").
-- Run in Supabase → SQL Editor (or `npm run db:push`).

create table if not exists public.share_links (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,               -- random url-safe, minted by the app
  owner_id     uuid not null references auth.users (id) on delete cascade,
  target_type  text not null check (target_type in ('file', 'folder')),
  file_id      uuid references public.files (id)   on delete cascade,
  folder_id    uuid references public.folders (id) on delete cascade,
  expires_at   timestamptz,                         -- null = never expires
  access_count integer not null default 0,
  created_at   timestamptz not null default now(),

  -- Exactly one target, matching target_type. A file link carries file_id only,
  -- a folder link folder_id only. The on-delete cascade above means deleting the
  -- shared file/folder also drops its share links (no dangling public URLs).
  constraint share_links_target_matches check (
    (target_type = 'file'   and file_id   is not null and folder_id is null) or
    (target_type = 'folder' and folder_id is not null and file_id   is null)
  )
);

alter table public.share_links enable row level security;

-- Owner-only management at the data layer. Anonymous visitors never touch this
-- table directly — the app resolves tokens with the service-role client.
create policy "share_links: owner read"
  on public.share_links for select
  using (auth.uid() = owner_id);

create policy "share_links: owner insert"
  on public.share_links for insert
  with check (auth.uid() = owner_id);

create policy "share_links: owner update"
  on public.share_links for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "share_links: owner delete"
  on public.share_links for delete
  using (auth.uid() = owner_id);

-- List a user's links newest-first.
create index if not exists share_links_owner_created_idx
  on public.share_links (owner_id, created_at desc);

-- Cron purge of expired links scans by expiry.
create index if not exists share_links_expires_idx
  on public.share_links (expires_at)
  where expires_at is not null;

-- Live "Linkurile mele" (access-count bumps + revokes reflect instantly).
alter table public.share_links replica identity full;
alter publication supabase_realtime add table public.share_links;
