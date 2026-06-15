-- ngig.cloud — instant forced sign-out + switch block to app-owned flag
-- Run in Supabase → SQL Editor.

-- Tokens issued before this moment are rejected by the middleware (instant
-- sign-out, independent of token expiry). Set on forced sign-out / block.
alter table public.profiles
  add column if not exists force_logout_at timestamptz;

-- Recreate the user listing to expose our own block flag (blocked_until)
-- instead of the Supabase auth ban (we no longer use the native ban).
-- The return columns changed, so the old function must be dropped first.
drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id               uuid,
  username         text,
  email            text,
  role             text,
  account_created  timestamptz,
  last_sign_in_at  timestamptz,
  blocked_until    timestamptz,
  last_seen_at     timestamptz,
  last_download_at timestamptz,
  max_file_size    bigint,
  max_total_size   bigint,
  blocked_reason   text,
  total_size       bigint,
  file_count       bigint,
  last_upload_at   timestamptz,
  last_upload_size bigint,
  last_city        text,
  last_country     text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.username,
    u.email,
    p.role,
    p.created_at,
    u.last_sign_in_at,
    p.blocked_until,
    p.last_seen_at,
    p.last_download_at,
    p.max_file_size,
    p.max_total_size,
    p.blocked_reason,
    coalesce(f.total_size, 0),
    coalesce(f.file_count, 0),
    f.last_upload_at,
    f.last_upload_size,
    la.city,
    la.country
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join lateral (
    select
      sum(size)        as total_size,
      count(*)         as file_count,
      max(created_at)  as last_upload_at,
      (select size from public.files f2
        where f2.owner_id = p.id
        order by created_at desc limit 1) as last_upload_size
    from public.files f1
    where f1.owner_id = p.id
  ) f on true
  left join lateral (
    select city, country
    from public.login_audit
    where user_id = p.id
    order by created_at desc
    limit 1
  ) la on true
  order by p.created_at desc;
$$;

revoke execute on function public.admin_list_users() from anon, authenticated;
