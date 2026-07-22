-- User-owned storage preferences (set from their own profile page):
--   self_max_file_size — a personal per-file upload cap. Only meaningful when
--     no admin limit applies (per-user or global); the admin limit always wins.
--   storage_alert — one alert threshold on total usage:
--     {"mode": "percent"|"absolute", "value": n, "fired": bool}
--     (percent = % of the effective quota; absolute = bytes; fired re-arms
--     when usage drops back under the threshold). NULL = off.
-- Deliberately NOT in the privileged-columns trigger: these are the user's own
-- harmless preferences.
alter table public.profiles
  add column if not exists self_max_file_size bigint,
  add column if not exists storage_alert jsonb;
