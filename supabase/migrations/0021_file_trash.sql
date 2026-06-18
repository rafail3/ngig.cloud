-- ngig.cloud — Trash (soft delete) for files. A trashed file keeps its B2 object
-- and its DB row, but gets `deleted_at` set so it's hidden from normal listings
-- until the user restores it or empties the trash (permanent delete). The Trash
-- view + restore/permanent-delete land in a later task; this migration only adds
-- the column + index the app filters on. Run in Supabase → SQL Editor.

alter table public.files
  add column if not exists deleted_at timestamptz;

-- Live files (deleted_at is null) vs. trashed — both lookups stay index-backed.
create index if not exists files_owner_deleted_idx
  on public.files (owner_id, deleted_at);
