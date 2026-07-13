-- Realtime for the dashboard + profile. Adding these tables to the realtime
-- publication lets the client subscribe to row changes and refresh the (server-
-- rendered) pages instantly. Realtime respects RLS, so a subscriber only
-- receives changes it is allowed to read (admins via is_admin() policies; a user
-- only their own profile row).

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.invite_codes;
alter publication supabase_realtime add table public.invite_requests;
alter publication supabase_realtime add table public.app_settings;
alter publication supabase_realtime add table public.login_audit;

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the full old row (needed
-- for RLS filters to evaluate on updates/deletes).
alter table public.profiles replica identity full;
alter table public.invite_codes replica identity full;
alter table public.invite_requests replica identity full;
alter table public.app_settings replica identity full;
alter table public.login_audit replica identity full;
