-- Overview leaderboard: the most active users over a rolling window.
-- Combined activity score, weighted so real contribution (uploads) outranks
-- passive actions and bare logins:
--   score = uploads*3 + downloads*2 + other_actions*1 + logins*1
-- Aggregation happens in the DB (never pull raw events into Node). SECURITY
-- DEFINER + revoke: only the service-role key reaches it, like the other
-- admin_* stat RPCs — the dashboard calls it with that key.
create or replace function public.admin_active_users(days int default 30, lim int default 10)
returns table (
  user_id       uuid,
  username      text,
  uploads       bigint,
  downloads     bigint,
  other_actions bigint,
  logins        bigint,
  score         bigint,
  last_active   timestamptz,
  storage_bytes bigint,
  file_count    bigint,
  last_city     text,
  last_country  text
)
language sql
security definer
set search_path = public
as $$
  with win as (
    select now() - (greatest(days, 1) || ' days')::interval as since
  ),
  ev as (
    select
      e.user_id,
      count(*) filter (where e.type = 'upload')                     as uploads,
      count(*) filter (where e.type = 'download')                   as downloads,
      count(*) filter (where e.type not in ('upload', 'download'))  as other_actions,
      max(e.created_at)                                             as last_ev
    from public.user_events e, win
    where e.created_at >= win.since
    group by e.user_id
  ),
  lg as (
    select l.user_id, count(*) as logins, max(l.created_at) as last_login
    from public.login_audit l, win
    where l.created_at >= win.since and l.user_id is not null
    group by l.user_id
  ),
  st as (
    select f.owner_id as user_id,
           coalesce(sum(f.size), 0) as storage_bytes,
           count(*)                 as file_count
    from public.files f
    where f.deleted_at is null and f.archived_at is null
    group by f.owner_id
  ),
  agg as (
    select
      p.id       as user_id,
      p.username,
      coalesce(ev.uploads, 0)       as uploads,
      coalesce(ev.downloads, 0)     as downloads,
      coalesce(ev.other_actions, 0) as other_actions,
      coalesce(lg.logins, 0)        as logins,
      coalesce(ev.uploads, 0) * 3
        + coalesce(ev.downloads, 0) * 2
        + coalesce(ev.other_actions, 0)
        + coalesce(lg.logins, 0)    as score,
      greatest(
        coalesce(ev.last_ev, 'epoch'::timestamptz),
        coalesce(lg.last_login, 'epoch'::timestamptz),
        coalesce(p.last_seen_at, 'epoch'::timestamptz)
      )                             as last_active,
      coalesce(st.storage_bytes, 0) as storage_bytes,
      coalesce(st.file_count, 0)    as file_count,
      -- city/country aren't columns on profiles; take the latest login_audit
      -- row, same as admin_list_users.
      loc.city    as last_city,
      loc.country as last_country
    from public.profiles p
    left join ev on ev.user_id = p.id
    left join lg on lg.user_id = p.id
    left join st on st.user_id = p.id
    left join lateral (
      select city, country
      from public.login_audit
      where user_id = p.id
      order by created_at desc
      limit 1
    ) loc on true
  )
  select
    user_id, username, uploads, downloads, other_actions, logins, score,
    nullif(last_active, 'epoch'::timestamptz) as last_active,
    storage_bytes, file_count, last_city, last_country
  from agg
  where score > 0
  order by score desc, last_active desc nulls last
  limit greatest(lim, 1);
$$;

revoke execute on function public.admin_active_users(int, int) from anon, authenticated;
