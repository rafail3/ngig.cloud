-- ngig.cloud — user directory: browse/search other users, view a public profile.
--
-- `search_users` (20260727090000_user_transfers.sql) stays untouched — it is
-- tuned for the transfer typeahead (hard limit 8, id+username only). These two
-- functions serve the directory page and the profile panel instead.
--
-- Both are SECURITY DEFINER for the same reason search_users is: profiles RLS
-- is self-or-admin-only, so a normal session cannot read another user's row.
-- They expose EXACTLY username + created_at — never email, and never `role`
-- (admin/manager standing is internal information, not part of a public
-- profile).
-- Run in Supabase → SQL Editor (or `npm run db:push`).

-- Paginated directory listing. An empty query lists everyone (alphabetically);
-- the caller is always excluded — you don't browse to yourself.
create or replace function public.directory_users(
  q   text default '',
  lim int  default 24,
  off int  default 0
)
returns table (id uuid, username text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username, p.created_at
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and (q = '' or p.username ilike '%' || q || '%')
  order by p.username
  -- Clamp server-side: a hostile client must not be able to ask for the whole
  -- table in one call, nor for a negative offset.
  limit  least(greatest(lim, 1), 50)
  offset greatest(off, 0);
$$;

-- One user's public profile. `shared_transfers` counts transfers between the
-- CALLER and the target in either direction — it is the caller's own
-- relationship data, so no third-party information leaks.
create or replace function public.public_profile(target_id uuid)
returns table (
  id               uuid,
  username         text,
  created_at       timestamptz,
  shared_transfers bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.created_at,
    (
      select count(*)
      from public.transfers t
      where (t.sender_id = auth.uid() and t.recipient_id = p.id)
         or (t.sender_id = p.id        and t.recipient_id = auth.uid())
    )
  from public.profiles p
  where p.id = target_id
    and auth.uid() is not null;
$$;

revoke execute on function public.directory_users(text, int, int) from anon;
grant  execute on function public.directory_users(text, int, int) to authenticated;
revoke execute on function public.public_profile(uuid) from anon;
grant  execute on function public.public_profile(uuid) to authenticated;
