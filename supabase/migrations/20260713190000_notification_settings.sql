-- Per-type notification switches. A notification event fires only if its type
-- is enabled here. Types default to enabled (a missing row = on), so a new event
-- added in code works out of the box; the admin can turn any of them off.

create table public.notification_settings (
  type       text primary key,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

-- Admin-only. Reads for the runtime gate use the service-role client; writes go
-- through the admin-gated action.
create policy notification_settings_admin_all on public.notification_settings
  for all
  using (is_admin())
  with check (is_admin());
