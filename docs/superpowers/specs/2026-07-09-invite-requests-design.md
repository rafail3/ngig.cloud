# Design: Dashboard invite-requests (TASK 53)

**Date:** 2026-07-09
**Status:** Approved, pending implementation
**Branch:** `feat/invite-requests`

## Goal

Persist invite requests submitted at `/cere-invitatie` (today only emailed to the
owner) and surface them on a new admin dashboard page "Cereri de invitație", where
an admin can approve (auto-generate a code + send the approval email), reject, or
delete a request.

## Current state (grounded)

- `/cere-invitatie` → `requestInviteAction` (`src/app/cere-invitatie/actions.ts`):
  validates name/email/message + Turnstile, blocks if `emailHasAccount(email)`,
  then sends `sendInviteRequest` (owner notice) + `sendInviteRequestAck`
  (requester). **Nothing is persisted.**
- Dashboard `/invites` (`src/app/dashboard/(panel)/invites/`) manages invite
  **codes** (create/revoke/delete/list) via `src/server/invites/service.ts`
  (admin/service-role client, `admin_list_invites` RPC). This is a separate
  concept from requests.
- Invite codes are created with `createInvite({expiry, role, email, label,
  createdBy})`. Approval flow 27 already pre-fills the code from
  `/register?code=XXX`.

## Decisions (locked)

- **Approve = automatic:** one click generates an invite code with the
  requester's email pre-filled (default **expiry `1w`, role `user`**), sets the
  request to `approved`, links the code, and emails the requester an approval
  with a `/register?code=XXX` link.
- **States:** `pending` / `approved` / `rejected`, plus hard delete.
- **Duplicate guard:** a new request whose email already has a `pending` request
  is politely rejected ("ai deja o cerere în așteptare").
- **Keep both existing emails** (owner notice + requester ack) AND add the row.
- **Route** is English (`/dashboard/invite-requests`), UI copy Romanian, per the
  English-routes convention.

## Data model — migration `invite_requests`

```sql
create table public.invite_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  message        text,
  ip             text,
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  invite_code_id uuid references public.invite_codes(id) on delete set null,
  handled_by     uuid references auth.users(id) on delete set null,
  handled_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index invite_requests_status_created_idx
  on public.invite_requests (status, created_at desc);
-- Enforces the duplicate guard at the DB layer (one pending row per email).
create unique index invite_requests_one_pending_per_email
  on public.invite_requests (lower(email)) where status = 'pending';

alter table public.invite_requests enable row level security;
-- Admin-only, mirroring invite_codes (is_admin() helper already exists).
create policy invite_requests_admin_all on public.invite_requests
  for all using (is_admin()) with check (is_admin());
```

Notes:
- The partial unique index makes the duplicate guard race-safe (not just an
  app-level check). Insert path handles the unique-violation (23505) gracefully.
- Writes happen through the service-role client (bypasses RLS); the RLS policy
  protects any user-scoped reads and is defense-in-depth.

## Server — extend `src/server/invites/service.ts`

- `type InviteRequestRow` — id, name, email, message, ip, status,
  invite_code_id, handled_by, handled_at, created_at (+ resolved code string
  when approved).
- `createInviteRequest({name, email, message, ip})` — INSERT `pending`; on
  unique-violation (23505) return a sentinel/throw a typed "already pending"
  error the action maps to the polite message.
- `listInviteRequests()` — admin; order pending-first, then `created_at desc`.
- `approveInviteRequest(id, adminId, origin)` — load the request; `createInvite`
  with `{expiry:'1w', role:'user', email, createdBy: adminId}`; update row to
  `approved` + `handled_at/by` + `invite_code_id`; `sendInviteApproval`. Return
  the generated code. Guard: only a `pending` request can be approved.
- `rejectInviteRequest(id, adminId)` — set `rejected` + handled_at/by (only from
  `pending`).
- `deleteInviteRequest(id)` — hard delete.

## Email — `src/server/email/resend.ts`

- `sendInviteApproval({name, email, code, origin})` — approval email with a
  "Creează-ți contul" button linking to `${origin}/register?code=${code}`.
  Mirror the existing invite/ack email style.

## Persistence wiring — `requestInviteAction`

After the existing validation + `emailHasAccount` check, and BEFORE the emails:
`createInviteRequest(...)`. If it reports "already pending", return the polite
error. Keep `sendInviteRequest` + `sendInviteRequestAck` exactly as they are
(row is the source of truth; emails stay best-effort).

## Dashboard UI — `src/app/dashboard/(panel)/invite-requests/`

- `page.tsx` (server, `requireAdmin` / admin layout gate) lists requests via
  `listInviteRequests()`.
- New sidebar nav item "Cereri de invitație" in the dashboard nav (next to
  Invitații).
- Row: name, email, message (truncate + expand), created date
  (Europe/Bucharest), IP, status badge.
  - `pending` → **Aprobă** (one click) + **Respinge**.
  - `approved` → show the code / `/register?code=` link + copy, status badge.
  - `rejected` → badge + **Șterge**.
- `actions.ts` — `approveRequestAction` / `rejectRequestAction` /
  `deleteRequestAction`, each `requireAdmin`, then `revalidatePath` the page.
  Approve reads request origin from headers for the email link.

## Out of scope (YAGNI)

- No expiry/role picker on approve (fixed `1w`/`user`).
- No editing a request. No requester-facing status page.
- No notifications (that's task 50, later).

## Testing / verification

- Submit `/cere-invitatie` → row appears `pending` in the dashboard.
- Second submit same email while pending → polite "already pending" error, no
  new row.
- Approve → code generated, row `approved` with code linked, approval email
  sent, `/register?code=` pre-fills the code (flow 27).
- Reject → row `rejected`. Delete → row gone.
- Non-admin cannot reach the page or actions.
```
