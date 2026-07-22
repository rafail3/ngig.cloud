-- Fix duplicate "new version" notifications.
--
-- The old claim stored only the LAST announced version in app_settings. During
-- a rollout Vercel serves BOTH deployments for a while (old functions stay
-- alive for already-open tabs), so the two versions ping-ponged the single
-- key — each flip "claimed" again and re-broadcast (v2.30, v2.31, v2.30, …).
--
-- A version can now be announced exactly ONCE, ever: claims land in a table
-- keyed by version, and only the inserting request wins.

create table if not exists public.announced_versions (
  version      text primary key,
  announced_at timestamptz not null default now()
);

alter table public.announced_versions enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.

create or replace function public.claim_update_version(v text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  insert into public.announced_versions (version) values (v)
  on conflict (version) do nothing;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke execute on function public.claim_update_version(text) from anon, authenticated;

-- Seed with the version the old mechanism last announced, so the migration
-- itself doesn't cause one more re-announcement of the current deploy.
insert into public.announced_versions (version)
select trim(both '"' from value::text)
from public.app_settings
where key = 'update_notify_last_version' and value is not null
on conflict (version) do nothing;
