-- ngig.cloud — check whether an email already has an account.
--
-- Used by the public "request invite" form to reject requests from people who
-- already have an account (they should log in, not request an invite). Reads
-- auth.users via a security-definer function (same pattern as admin_list_users),
-- callable only by the service-role client server-side. Run in Supabase.

create or replace function public.email_has_account(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(p_email)
  );
$$;

revoke execute on function public.email_has_account(text) from anon, authenticated;
grant execute on function public.email_has_account(text) to service_role;
