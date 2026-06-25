-- ngig.cloud — profile email change with a custom confirmation flag.
--
-- A user can change their account email from the cloud. The change applies
-- immediately (login is by username, so a wrong email never locks anyone out),
-- but the NEW address must be activated via a one-time token sent by email.
-- Until activated, `email_confirmed` is false and the admin user-detail screen
-- flags it. Existing/new accounts default to confirmed; only an un-activated
-- email change shows as unconfirmed. Run in Supabase → SQL Editor.

alter table public.profiles
  add column if not exists email_confirmed     boolean not null default true,
  add column if not exists email_confirm_token text;

-- Recreate admin_list_users to also return email_confirmed (return shape
-- changed, so drop first). Mirrors 0009 with the new column after `email`.
drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id               uuid,
  username         text,
  email            text,
  email_confirmed  boolean,
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
    p.email_confirmed,
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
