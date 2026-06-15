-- ngig.cloud — storage migration: Cloudflare R2 → Backblaze B2.
-- The object key is provider-agnostic (still `<owner_id>/<uuid>`), so we just
-- rename the column to drop the R2-specific name. Run in Supabase → SQL Editor.

alter table public.files rename column r2_key to storage_key;
