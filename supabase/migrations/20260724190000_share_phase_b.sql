-- ngig.cloud — share links Faza B: optional password, download limit, and an
-- access-notification toggle.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

alter table public.share_links
  add column if not exists password_hash    text,
  add column if not exists max_downloads    integer,
  add column if not exists download_count   integer not null default 0,
  add column if not exists notify_on_access  boolean not null default false,
  add column if not exists last_notified_at timestamptz;

-- max_downloads, when set, must be positive.
alter table public.share_links
  drop constraint if exists share_links_max_downloads_positive;
alter table public.share_links
  add constraint share_links_max_downloads_positive
  check (max_downloads is null or max_downloads > 0);

-- Atomic download-limit enforcement: increment download_count only while under
-- the limit, in a single guarded UPDATE, and report whether it was allowed.
-- Returns true = this download is permitted (and counted); false = limit reached.
-- Called only server-side (service-role), so it's locked to that role.
create or replace function public.try_consume_share_download(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  update public.share_links
    set download_count = download_count + 1
    where id = p_id
      and (max_downloads is null or download_count < max_downloads)
    returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke execute on function public.try_consume_share_download(uuid) from public;
grant  execute on function public.try_consume_share_download(uuid) to service_role;
