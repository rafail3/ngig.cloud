-- Realtime for the drive: broadcast files/folders row changes so the client's
-- SWR layer can refresh instantly (upload / move / rename / trash sync across a
-- user's tabs and devices). Realtime respects RLS, so each client only receives
-- changes to its own rows.

alter publication supabase_realtime add table public.files;
alter publication supabase_realtime add table public.folders;

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the full old row — needed
-- for the owner_id RLS filter to evaluate on deletes (default identity only
-- ships the primary key).
alter table public.files replica identity full;
alter table public.folders replica identity full;
