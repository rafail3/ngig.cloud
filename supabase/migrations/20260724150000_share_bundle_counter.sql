-- ngig.cloud — share links: multi-item bundles + an atomic access counter.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

-- 1) Atomic access counter -------------------------------------------------
-- The public page bumps access_count on every open. A read-modify-write can
-- lose increments under concurrent hits; this does it atomically in one UPDATE.
-- Called only from the server (service-role client), so it's locked to that role.
create or replace function public.bump_share_access(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_links set access_count = access_count + 1 where id = p_id;
$$;

revoke execute on function public.bump_share_access(uuid) from public;
grant execute on function public.bump_share_access(uuid) to service_role;

-- 2) Multi-item bundles ----------------------------------------------------
-- A link can now target a BUNDLE of several files/folders (multi-select share).
-- The bundle's members live in share_link_items; the share_links row carries
-- target_type='bundle' with both file_id and folder_id null.
alter table public.share_links drop constraint if exists share_links_target_matches;
alter table public.share_links
  add constraint share_links_target_matches check (
    (target_type = 'file'   and file_id   is not null and folder_id is null) or
    (target_type = 'folder' and folder_id is not null and file_id   is null) or
    (target_type = 'bundle' and file_id   is null     and folder_id is null)
  );

create table if not exists public.share_link_items (
  id        uuid primary key default gen_random_uuid(),
  share_id  uuid not null references public.share_links (id) on delete cascade,
  file_id   uuid references public.files (id)   on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,

  -- exactly one target per item
  constraint share_link_items_one_target check (
    (file_id is not null and folder_id is null) or
    (folder_id is not null and file_id is null)
  )
);

create index if not exists share_link_items_share_idx
  on public.share_link_items (share_id);

alter table public.share_link_items enable row level security;

-- Owner manages items of their OWN shares (joined back through share_links).
-- Anonymous resolution reads these through the service-role client (RLS bypass).
create policy "share_link_items: owner all"
  on public.share_link_items for all
  using (
    exists (
      select 1 from public.share_links s
      where s.id = share_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.share_links s
      where s.id = share_id and s.owner_id = auth.uid()
    )
  );
