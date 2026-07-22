-- Egress accuracy: previews used to log the file's FULL size on every open —
-- but repeated opens hit the browser cache and video/audio streams only the
-- watched ranges, so the meter ran far ahead of what B2 actually bills.
-- file_id lets the logger dedup preview events per (user, file) within a
-- window. Nullable, no FK: the row must survive the file's deletion (it is a
-- billing record).
alter table public.egress_events
  add column if not exists file_id uuid;

create index if not exists egress_events_dedup_idx
  on public.egress_events (user_id, file_id, source, created_at desc);
