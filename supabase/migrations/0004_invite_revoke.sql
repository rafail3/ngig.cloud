-- ngig.cloud — invite codes: manual revocation + optional label
-- Run in Supabase → SQL Editor.

-- Lets an admin invalidate a code before it expires or is used.
alter table public.invite_codes
  add column if not exists revoked_at timestamptz;

-- Optional human note (e.g. "pentru Andrei", "beta testers").
alter table public.invite_codes
  add column if not exists label text;
