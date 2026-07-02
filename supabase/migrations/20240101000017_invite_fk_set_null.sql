-- ngig.cloud — let users be deleted without invite_codes blocking it
-- Run in Supabase → SQL Editor.
-- invite_codes.used_by / created_by referenced auth.users with NO on-delete
-- action (RESTRICT), so deleting a user failed if any code referenced them.
-- Switch to ON DELETE SET NULL: the code row stays, the reference clears.

alter table public.invite_codes drop constraint if exists invite_codes_used_by_fkey;
alter table public.invite_codes
  add constraint invite_codes_used_by_fkey
  foreign key (used_by) references auth.users (id) on delete set null;

alter table public.invite_codes drop constraint if exists invite_codes_created_by_fkey;
alter table public.invite_codes
  add constraint invite_codes_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;
