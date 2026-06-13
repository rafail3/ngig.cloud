-- ngig.cloud — file storage: metadata for objects stored in Cloudflare R2.
-- The bytes live in R2; this table holds metadata + ownership for access control.
-- Run in Supabase → SQL Editor.

create table if not exists public.files (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  size       bigint not null default 0,
  mime_type  text,
  r2_key     text not null unique,          -- object key in R2, e.g. <owner_id>/<uuid>
  created_at timestamptz not null default now()
);

alter table public.files enable row level security;

-- Owner-only access at the data layer.
create policy "files: owner can read"
  on public.files for select
  using (auth.uid() = owner_id);

create policy "files: owner can insert"
  on public.files for insert
  with check (auth.uid() = owner_id);

create policy "files: owner can update"
  on public.files for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "files: owner can delete"
  on public.files for delete
  using (auth.uid() = owner_id);

create index if not exists files_owner_created_idx
  on public.files (owner_id, created_at desc);
