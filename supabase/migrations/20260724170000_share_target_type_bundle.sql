-- ngig.cloud — allow target_type='bundle' on share_links.
-- The original share_links migration declared the column inline as
--   target_type text not null check (target_type in ('file','folder'))
-- which Postgres named `share_links_target_type_check`. The bundle migration
-- only replaced the multi-column `share_links_target_matches` check, so this
-- column-level check still rejected 'bundle'. Widen it here.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

alter table public.share_links
  drop constraint if exists share_links_target_type_check;

alter table public.share_links
  add constraint share_links_target_type_check
  check (target_type in ('file', 'folder', 'bundle'));
