-- Invite requests submitted at /cere-invitatie. Until now these were only
-- emailed to the owner; persist them so the dashboard can list and act on them.

create table public.invite_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  message        text,
  ip             text,
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  invite_code_id uuid references public.invite_codes (id) on delete set null,
  handled_by     uuid references auth.users (id) on delete set null,
  handled_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- List ordering: newest first, filtered/grouped by status.
create index invite_requests_status_created_idx
  on public.invite_requests (status, created_at desc);

-- Duplicate guard, enforced at the DB layer (race-safe): at most one pending
-- request per email (case-insensitive). Approving/rejecting frees the email.
create unique index invite_requests_one_pending_per_email
  on public.invite_requests (lower(email))
  where status = 'pending';

alter table public.invite_requests enable row level security;

-- Admin-only, mirroring invite_codes. is_admin() is defined in 0001_init_auth.
-- Writes go through the service-role client (bypasses RLS); this policy is
-- defense-in-depth for any user-scoped access.
create policy invite_requests_admin_all on public.invite_requests
  for all
  using (is_admin())
  with check (is_admin());
