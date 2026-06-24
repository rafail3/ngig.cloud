-- ngig.cloud — Archive (organisational soft-state) for files. An archived file
-- keeps its B2 object, its DB row and its folder, but gets `archived_at` set so
-- it leaves the drive + global search and lives in the dedicated Archive view
-- until the user unarchives it. Distinct from trash (`deleted_at`): archived
-- files are kept indefinitely and still count toward quota. They are never
-- auto-purged. Run in Supabase → SQL Editor.

alter table public.files
  add column if not exists archived_at timestamptz;

-- Active vs. archived lookups stay index-backed (alongside the trash filter).
create index if not exists files_owner_archived_idx
  on public.files (owner_id, archived_at);
