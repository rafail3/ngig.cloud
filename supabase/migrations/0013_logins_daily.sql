-- ngig.cloud — daily login counts for the overview "accesări" chart
-- Run in Supabase → SQL Editor.

create or replace function public.admin_logins_daily(days int)
returns table (day date, count bigint)
language sql security definer stable set search_path = public
as $$
  select
    date_trunc('day', created_at)::date as day,
    count(*)                            as count
  from public.login_audit
  where created_at >= now() - make_interval(days => days)
  group by 1
  order by 1;
$$;

revoke execute on function public.admin_logins_daily(int) from anon, authenticated;
