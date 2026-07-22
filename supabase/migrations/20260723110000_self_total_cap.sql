-- Correction to the self-limit shipped in the previous migration: the user's
-- own cap is on TOTAL storage (a personal budget), not per file. Safe whether
-- or not the previous migration was applied.
alter table public.profiles
  drop column if exists self_max_file_size;

alter table public.profiles
  add column if not exists self_max_total_size bigint;
