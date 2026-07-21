-- ngig.cloud — atomic claim for the "new version" update notification.
--
-- The first request to observe a newly-deployed version claims it (sets the
-- stored last-notified version and returns true); every other concurrent
-- request/instance gets false. This guarantees the update broadcast fires
-- exactly once per deploy. Run in Supabase → SQL Editor.

create or replace function public.claim_update_version(v text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  insert into public.app_settings (key, value, updated_at)
  values ('update_notify_last_version', to_jsonb(v), now())
  on conflict (key) do update
    set value = to_jsonb(v), updated_at = now()
    where public.app_settings.value is distinct from to_jsonb(v);
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke execute on function public.claim_update_version(text) from anon, authenticated;
