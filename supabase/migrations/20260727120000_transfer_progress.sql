-- ngig.cloud — live progress on user-to-user transfers.
-- acceptTransfer sets progress_total right before it starts copying, then
-- updates progress_done as it goes (throttled). Both parties are already
-- subscribed to `transfers` via Realtime (see 20260727090000_user_transfers.sql),
-- so these columns stream to the UI for free — no new publication/replica work.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

alter table public.transfers
  add column if not exists progress_done  bigint not null default 0,
  add column if not exists progress_total bigint;
