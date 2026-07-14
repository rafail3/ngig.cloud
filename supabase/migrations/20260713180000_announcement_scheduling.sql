-- Scheduled announcements: deliver at a chosen time via pg_cron, even with no
-- admin online. scheduled_at = when to send (null = immediate); sent_at = when
-- the fan-out actually ran (null = still pending).

alter table public.announcements add column scheduled_at timestamptz;
alter table public.announcements add column sent_at timestamptz;

-- Existing rows were delivered on creation.
update public.announcements set sent_at = created_at where sent_at is null;

-- Fan an announcement out to every account. Idempotent: a no-op if already
-- sent. SECURITY DEFINER so both pg_cron and the service-role immediate path can
-- insert notifications regardless of RLS. Returns the recipient count.
create or replace function public.fanout_announcement(ann_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ann public.announcements%rowtype;
  cnt integer;
begin
  select * into ann from public.announcements where id = ann_id;
  if ann.id is null or ann.sent_at is not null then
    return coalesce(ann.recipient_count, 0);
  end if;

  insert into public.notifications (user_id, type, title, body, link, announcement_id)
  select p.id, 'announcement', '📣 ' || ann.title, ann.body, ann.link, ann.id
  from public.profiles p;
  get diagnostics cnt = row_count;

  update public.announcements
    set sent_at = now(), recipient_count = cnt
    where id = ann_id;

  return cnt;
end;
$$;

-- Deliver every due scheduled announcement. Invoked by pg_cron each minute.
create or replace function public.dispatch_due_announcements()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in
    select id from public.announcements
    where sent_at is null and scheduled_at is not null and scheduled_at <= now()
  loop
    perform public.fanout_announcement(r.id);
  end loop;
end;
$$;

-- App users must never call these directly — only the service role / cron.
revoke all on function public.fanout_announcement(uuid) from public, anon, authenticated;
revoke all on function public.dispatch_due_announcements() from public, anon, authenticated;

-- Minute-level scheduler. If pg_cron isn't enabled, enable it in
-- Supabase → Database → Extensions, then re-run the two statements below.
create extension if not exists pg_cron;
select cron.schedule(
  'dispatch-announcements',
  '* * * * *',
  $$select public.dispatch_due_announcements();$$
);
