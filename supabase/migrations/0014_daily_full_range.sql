-- ngig.cloud — fill the daily charts across the whole window (zeros on idle days)
-- Run in Supabase → SQL Editor.
-- generate_series builds every day in range; LEFT JOIN yields 0 where no rows.

create or replace function public.admin_uploads_daily(days int)
returns table (day date, count bigint, size bigint)
language sql security definer stable set search_path = public
as $$
  select
    d::date                  as day,
    count(f.id)              as count,
    coalesce(sum(f.size), 0) as size
  from generate_series(current_date - (days - 1), current_date, interval '1 day') d
  left join public.files f
    on date_trunc('day', f.created_at)::date = d::date
  group by d
  order by d;
$$;

create or replace function public.admin_logins_daily(days int)
returns table (day date, count bigint)
language sql security definer stable set search_path = public
as $$
  select
    d::date       as day,
    count(la.id)  as count
  from generate_series(current_date - (days - 1), current_date, interval '1 day') d
  left join public.login_audit la
    on date_trunc('day', la.created_at)::date = d::date
  group by d
  order by d;
$$;
