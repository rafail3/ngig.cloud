-- ngig.cloud — backfill thumbnails for files uploaded before thumbnails shipped.
--
-- Thumbnails are generated in the browser (see 20260803120000_file_thumbnails),
-- so every file uploaded before that has `thumb_key = null` and shows a type
-- icon. Backfilling means re-reading the original — the browser does it lazily,
-- for files it is actually rendering.
--
-- `thumb_failed_at` is the memory of a failed attempt: a codec the browser can't
-- decode, a corrupt file, an object no longer in B2. Without it every folder
-- open would re-download the same unrenderable files forever. It is a timestamp
-- rather than a boolean so a future sweep can retry old failures (a browser that
-- couldn't decode a format last year may handle it now).
-- Run in Supabase → SQL Editor (or `npm run db:push`).

alter table public.files
  add column if not exists thumb_failed_at timestamptz;
