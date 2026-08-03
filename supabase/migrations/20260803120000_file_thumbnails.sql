-- ngig.cloud — thumbnails for images and videos in the file list.
--
-- The thumbnail is generated IN THE BROWSER at upload time (canvas for images, a
-- seeked frame for videos) and uploaded as its own small object. That is the
-- whole reason this is cheap: the browser already holds the file, so nothing has
-- to be downloaded back out of B2 to make a preview. Generating them server-side
-- would mean pulling every original through egress that the cost page measures.
--
-- `thumb_key` is null for every file uploaded before this shipped, and for any
-- type we can't render — the list falls back to the type icon, which is what it
-- shows today.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

alter table public.files
  add column if not exists thumb_key text;
