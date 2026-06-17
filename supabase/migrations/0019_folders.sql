-- ngig.cloud — folders (navigable structure). Bytes stay flat in B2 under
-- <owner>/<uuid>; folders are pure metadata so storage stays simple.
-- Run in Supabase → SQL Editor.

create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  parent_id  uuid references public.folders (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No two folders with the same name in the same parent (root = null parent).
create unique index if not exists folders_unique_name
  on public.folders (
    owner_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name
  );

create index if not exists folders_owner_parent_idx
  on public.folders (owner_id, parent_id);

alter table public.folders enable row level security;

create policy "folders: owner read"
  on public.folders for select using (auth.uid() = owner_id);
create policy "folders: owner insert"
  on public.folders for insert with check (auth.uid() = owner_id);
create policy "folders: owner update"
  on public.folders for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "folders: owner delete"
  on public.folders for delete using (auth.uid() = owner_id);

-- Files live in a folder (null = root). Deleting a folder cascades to its files'
-- rows (their B2 objects are removed by the app first).
alter table public.files
  add column if not exists folder_id uuid references public.folders (id) on delete cascade;

create index if not exists files_folder_idx
  on public.files (owner_id, folder_id);

-- Every storage key in a folder's subtree — used to delete the B2 objects before
-- removing the folder (whose row-cascade then drops the file rows).
create or replace function public.descendant_file_keys(fid uuid)
returns table (storage_key text)
language sql
security definer
stable
set search_path = public
as $$
  with recursive sub as (
    select id from public.folders where id = fid and owner_id = auth.uid()
    union all
    select f.id from public.folders f join sub s on f.parent_id = s.id
  )
  select fl.storage_key
  from public.files fl
  where fl.owner_id = auth.uid()
    and fl.folder_id in (select id from sub);
$$;

revoke execute on function public.descendant_file_keys(uuid) from anon;
grant   execute on function public.descendant_file_keys(uuid) to authenticated;
