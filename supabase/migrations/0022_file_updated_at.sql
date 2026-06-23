-- ngig.cloud — track when a file's CONTENT was last modified (in-app editing,
-- TASK 46). Existing rows get updated_at = created_at so nothing shows as
-- "modified" until it's actually edited. Rename/move are metadata-only and do
-- NOT bump this. Run in Supabase → SQL Editor.

-- Add nullable first, backfill, then lock down — so a re-run can never clobber
-- real modified timestamps (the backfill only touches rows still null).
alter table public.files add column if not exists updated_at timestamptz;

update public.files set updated_at = created_at where updated_at is null;

alter table public.files alter column updated_at set default now();
alter table public.files alter column updated_at set not null;
