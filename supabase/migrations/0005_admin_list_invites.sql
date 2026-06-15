-- ngig.cloud — fast invite listing: one query joining codes + profiles + auth
-- Run in Supabase → SQL Editor.
-- Replaces the per-code getUserById() round-trips with a single DB call.

create or replace function public.admin_list_invites()
returns table (
  id               uuid,
  code             text,
  email            text,
  role             text,
  label            text,
  expires_at       timestamptz,
  used_at          timestamptz,
  used_by          uuid,
  revoked_at       timestamptz,
  created_at       timestamptz,
  used_by_username text,
  used_by_email    text
)
language sql
security definer            -- needs to read auth.users.email
stable
set search_path = public
as $$
  select
    i.id, i.code, i.email, i.role, i.label,
    i.expires_at, i.used_at, i.used_by, i.revoked_at, i.created_at,
    p.username as used_by_username,
    u.email    as used_by_email
  from public.invite_codes i
  left join public.profiles p on p.id = i.used_by
  left join auth.users     u on u.id = i.used_by
  order by i.created_at desc;
$$;

-- Only the server (secret key) should call this. Block PostgREST callers.
revoke execute on function public.admin_list_invites() from anon, authenticated;
