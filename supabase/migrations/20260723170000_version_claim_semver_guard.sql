-- Guard the update-notification claim against stale deployments.
--
-- announced_versions already guarantees "once per version, ever". This closes
-- the remaining gap: an already-open tab can still hit the PREVIOUS deployment
-- after the new version was announced, and its version — never seen by the
-- table — would get announced once, late, out of order. A claim now succeeds
-- only when the version is strictly NEWER (semver) than the newest already
-- announced; older/equal versions are recorded silently so they are never
-- evaluated again.

create or replace function public.claim_update_version(v text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
  newest   text;
begin
  -- Newest announced version, by numeric semver order. If any stored version
  -- has a non-numeric shape the cast would fail — fall back to no guard
  -- rather than blocking the announcement path.
  begin
    select av.version into newest
    from public.announced_versions av
    order by string_to_array(av.version, '.')::int[] desc
    limit 1;

    if newest is not null
       and string_to_array(v, '.')::int[] <= string_to_array(newest, '.')::int[] then
      -- Stale (or already-known) version: remember it, never announce it.
      insert into public.announced_versions (version) values (v)
      on conflict (version) do nothing;
      return false;
    end if;
  exception when others then
    null; -- unparseable version somewhere: skip the guard, keep the once-ever rule
  end;

  insert into public.announced_versions (version) values (v)
  on conflict (version) do nothing;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke execute on function public.claim_update_version(text) from anon, authenticated;
