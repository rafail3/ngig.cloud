-- ngig.cloud — app-level block enforcement
-- Run in Supabase → SQL Editor.
-- Mirrors the ban end-time on the profile so the middleware can enforce a block
-- on the next request (the auth ban alone only bites at the next token refresh).

alter table public.profiles
  add column if not exists blocked_until timestamptz;
