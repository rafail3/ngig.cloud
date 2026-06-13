-- ngig.cloud — auth schema: profiles + invite_codes
-- Run in Supabase → SQL Editor.

-- =====================================================================
-- Tables
-- =====================================================================

-- One profile per auth user. role gates admin access.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique not null,
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- Single-use, expiring invite codes. Required to register.
create table if not exists public.invite_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  email      text,                                   -- optional: bind a code to an email
  role       text not null default 'user' check (role in ('admin', 'user')),
  expires_at timestamptz,                            -- null = never expires by time
  used_at    timestamptz,
  used_by    uuid references auth.users (id),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.profiles      enable row level security;
alter table public.invite_codes  enable row level security;

-- =====================================================================
-- Helper: is the current user an admin?
-- SECURITY DEFINER so it can read profiles without tripping RLS recursion.
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =====================================================================
-- Auto-create a profile when an auth user is created.
-- Reads username/role from the metadata we set server-side at registration.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS policies
-- =====================================================================

-- profiles: a user sees own profile; admins see all.
create policy "profiles: self or admin can read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- profiles: a user can update own profile; admins any.
create policy "profiles: self or admin can update"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- invite_codes: only admins touch them directly (dashboard).
-- The register flow reads/consumes codes server-side with the secret key,
-- which bypasses RLS — so regular users need no access here.
create policy "invite_codes: admin only"
  on public.invite_codes for all
  using (public.is_admin())
  with check (public.is_admin());
