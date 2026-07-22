-- Per-user activity detail for the Overview leaderboard's insights modal.
-- One round-trip: event counts, a gap-filled daily series (actions + logins),
-- a mime-grouped file-type breakdown, storage, file count, and profile facts.
-- SECURITY DEFINER + revoke, like the other admin_* stat RPCs — service-role
-- only. Daily buckets use UTC dates, matching admin_uploads_daily.
create or replace function public.admin_user_activity(uid uuid, days int default 30)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with win as (
    select greatest(days, 1) as n,
           (current_date - (greatest(days, 1) - 1)) as start_date
  ),
  cal as (
    select ((select start_date from win) + g)::date as day
    from generate_series(0, (select n - 1 from win)) g
  ),
  ev as (
    select created_at::date as day, type
    from public.user_events
    where user_id = uid
      and created_at >= (select start_date from win)::timestamptz
  ),
  ev_daily as (
    select day, count(*) as c from ev group by day
  ),
  lg as (
    select created_at::date as day
    from public.login_audit
    where user_id = uid
      and created_at >= (select start_date from win)::timestamptz
  ),
  lg_daily as (
    select day, count(*) as c from lg group by day
  ),
  daily as (
    select cal.day,
           coalesce(ev_daily.c, 0) as actions,
           coalesce(lg_daily.c, 0) as logins
    from cal
    left join ev_daily on ev_daily.day = cal.day
    left join lg_daily on lg_daily.day = cal.day
    order by cal.day
  ),
  ftypes as (
    select coalesce(nullif(split_part(mime_type, '/', 1), ''), 'altele') as category,
           count(*)               as count,
           coalesce(sum(size), 0) as bytes
    from public.files
    where owner_id = uid and deleted_at is null and archived_at is null
    group by 1
    order by count desc
  ),
  prof as (
    select username, created_at, last_seen_at from public.profiles where id = uid
  ),
  loc as (
    select city, country from public.login_audit
    where user_id = uid order by created_at desc limit 1
  )
  select jsonb_build_object(
    'username',    (select username from prof),
    'memberSince', (select created_at from prof),
    'lastSeen',    (select last_seen_at from prof),
    'city',        (select city from loc),
    'country',     (select country from loc),
    'counts', jsonb_build_object(
      'uploads',   (select count(*) from ev where type = 'upload'),
      'downloads', (select count(*) from ev where type = 'download'),
      'previews',  (select count(*) from ev where type = 'preview'),
      'searches',  (select count(*) from ev where type = 'search'),
      'other',     (select count(*) from ev where type not in ('upload', 'download', 'preview', 'search')),
      'logins',    (select count(*) from lg)
    ),
    'daily', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'day', to_char(day, 'YYYY-MM-DD'), 'actions', actions, 'logins', logins))
       from daily), '[]'::jsonb),
    'fileTypes', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'category', category, 'count', count, 'bytes', bytes))
       from ftypes), '[]'::jsonb),
    'storage',   coalesce((select sum(bytes) from ftypes), 0),
    'fileCount', coalesce((select sum(count) from ftypes), 0)
  );
$$;

revoke execute on function public.admin_user_activity(uuid, int) from anon, authenticated;
