-- ngig.cloud — global settings + overview aggregates
-- Run in Supabase → SQL Editor.

-- =====================================================================
-- Key-value settings (extensible — more keys land here later).
-- Known keys: global_max_file_size, default_user_quota, global_max_total
-- (bytes; a missing row means "unlimited").
-- =====================================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings: admin all" on public.app_settings;
create policy "app_settings: admin all"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- Aggregate helpers for enforcement + the overview dashboard.
-- security definer so they can read across all users (called by the
-- service key, or — platform_total_usage — during upload enforcement).
-- =====================================================================

-- Total bytes stored across the whole platform.
create or replace function public.platform_total_usage()
returns bigint
language sql security definer stable set search_path = public
as $$
  select coalesce(sum(size), 0) from public.files;
$$;

-- KPI snapshot: files, storage, users, online (active < 5 min).
create or replace function public.admin_overview()
returns table (
  file_count   bigint,
  total_size   bigint,
  user_count   bigint,
  online_count bigint
)
language sql security definer stable set search_path = public
as $$
  select
    (select count(*) from public.files),
    (select coalesce(sum(size), 0) from public.files),
    (select count(*) from public.profiles),
    (select count(*) from public.profiles
       where last_seen_at >= now() - interval '5 minutes');
$$;

-- File-type breakdown (major mime category).
create or replace function public.admin_file_types()
returns table (category text, count bigint, size bigint)
language sql security definer stable set search_path = public
as $$
  select
    coalesce(nullif(split_part(mime_type, '/', 1), ''), 'altele') as category,
    count(*)                                                       as count,
    coalesce(sum(size), 0)                                         as size
  from public.files
  group by 1
  order by count desc;
$$;

-- Daily uploads for the last N days.
create or replace function public.admin_uploads_daily(days int)
returns table (day date, count bigint, size bigint)
language sql security definer stable set search_path = public
as $$
  select
    date_trunc('day', created_at)::date as day,
    count(*)                            as count,
    coalesce(sum(size), 0)             as size
  from public.files
  where created_at >= now() - make_interval(days => days)
  group by 1
  order by 1;
$$;

revoke execute on function public.platform_total_usage() from anon, authenticated;
revoke execute on function public.admin_overview()        from anon, authenticated;
revoke execute on function public.admin_file_types()      from anon, authenticated;
revoke execute on function public.admin_uploads_daily(int) from anon, authenticated;
