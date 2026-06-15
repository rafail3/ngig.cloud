-- ngig.cloud — user management: tracking fields, per-user limits, login audit
-- Run in Supabase → SQL Editor.

-- Per-user tracking + storage overrides (null limit = no per-user cap).
alter table public.profiles
  add column if not exists last_seen_at     timestamptz,
  add column if not exists last_download_at timestamptz,
  add column if not exists max_file_size    bigint,
  add column if not exists max_total_size   bigint,
  add column if not exists blocked_reason   text;

-- Login history (IP + approximate location from Vercel geo headers).
create table if not exists public.login_audit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  ip         text,
  city       text,
  country    text,
  region     text,
  user_agent text
);

create index if not exists login_audit_user_idx
  on public.login_audit (user_id, created_at desc);

alter table public.login_audit enable row level security;

-- Admins can read; writes go through the secret key (bypasses RLS).
drop policy if exists "login_audit: admin read" on public.login_audit;
create policy "login_audit: admin read"
  on public.login_audit for select
  using (public.is_admin());

-- =====================================================================
-- One-shot admin user listing: profile + auth + file aggregates + last login.
-- =====================================================================
create or replace function public.admin_list_users()
returns table (
  id               uuid,
  username         text,
  email            text,
  role             text,
  account_created  timestamptz,
  last_sign_in_at  timestamptz,
  banned_until     timestamptz,
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
    u.banned_until,
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
