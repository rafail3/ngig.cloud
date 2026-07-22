-- Per-manager dashboard permissions. NULL (the default) = full access to every
-- section, so existing managers keep working unchanged. When set, the shape is
-- {"sections": ["invites", "users", ...]} — only the listed sections are
-- visible/usable; Overview and the manager's own profile are always allowed.
-- Only meaningful for role='admin' rows; ignored for plain users and the super
-- admin (who always has everything).
alter table public.profiles
  add column if not exists permissions jsonb;

-- SECURITY: the "self or admin can update" RLS policy lets a user UPDATE their
-- own profiles row via the REST API — which would include role,
-- is_super_admin, permissions and the block/limit columns. Every legitimate
-- write to those goes through server actions with the service-role key, so
-- block them for ordinary JWTs at the trigger level (RLS can't do per-column
-- checks). Service-role and direct-SQL (migrations, dashboard) writes pass.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- No JWT (direct SQL / migrations) or the service key → trusted.
  if coalesce(auth.role(), 'postgres') in ('service_role', 'postgres') then
    return new;
  end if;

  if new.role            is distinct from old.role
     or new.is_super_admin is distinct from old.is_super_admin
     or new.permissions    is distinct from old.permissions
     or new.blocked_until  is distinct from old.blocked_until
     or new.blocked_reason is distinct from old.blocked_reason
     or new.max_file_size  is distinct from old.max_file_size
     or new.max_total_size is distinct from old.max_total_size then
    raise exception 'Privileged profile columns can only be changed by the server.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns on public.profiles;
create trigger protect_privileged_profile_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();
