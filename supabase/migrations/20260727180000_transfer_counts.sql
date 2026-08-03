-- ngig.cloud — keep a transfer's item counts after its source rows are gone.
--
-- BUG THIS FIXES: `transfer_items.file_id`/`folder_id` are `on delete cascade`
-- (20260727090000_user_transfers.sql). A MOVE transfer deletes the sender's
-- originals on accept, which cascades the item rows away — so the history card
-- for a completed move rendered "0 fișiere". The label is derived at read time
-- by counting those rows, and there was nothing left to count.
--
-- Fix: denormalise the counts onto the transfer itself at creation. The
-- transfer row is the historical record; it must not depend on rows whose whole
-- purpose is to be deleted.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

alter table public.transfers
  add column if not exists folder_count int not null default 0,
  add column if not exists file_count   int not null default 0;

-- Backfill from whatever items still exist. Transfers whose items already
-- cascaded away stay at 0 — that information is genuinely gone and cannot be
-- reconstructed; only transfers created from here on are guaranteed accurate.
update public.transfers t
set
  folder_count = coalesce((
    select count(*) from public.transfer_items i
    where i.transfer_id = t.id and i.folder_id is not null
  ), 0),
  file_count = coalesce((
    select count(*) from public.transfer_items i
    where i.transfer_id = t.id and i.file_id is not null
  ), 0);
