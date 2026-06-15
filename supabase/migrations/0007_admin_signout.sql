-- ngig.cloud — force sign out a user by id
-- Run in Supabase → SQL Editor.
-- The JS admin API only signs out by JWT, not by user id. Deleting the user's
-- sessions revokes all refresh tokens (access tokens still expire normally).

create or replace function public.admin_sign_out_user(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions where user_id = uid;
$$;

revoke execute on function public.admin_sign_out_user(uuid) from anon, authenticated;
