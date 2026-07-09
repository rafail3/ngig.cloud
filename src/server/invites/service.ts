import "server-only";
import { randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExpiryOption = "never" | "1h" | "3h" | "1d" | "3d" | "1w" | "1mo";

export type InviteRow = {
  id: string;
  code: string;
  email: string | null;
  role: "user" | "admin";
  label: string | null;
  expires_at: string | null;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
  created_at: string;
  // resolved (only when used):
  used_by_username: string | null;
  used_by_email: string | null;
};

// High-entropy token: mixed case + digits + symbols. Copy/paste only (the
// admin copies it; it's never typed by hand), so readability isn't a concern.
// Excludes quotes/backslash/space to stay safe in form fields.
const CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}~?";
const CODE_LEN = 26;

// e.g. j?Ww03bg~0cotb}yX?vKiTGQN}
export function generateCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += CHARSET[randomInt(CHARSET.length)];
  return s;
}

const EXPIRY_MS: Record<Exclude<ExpiryOption, "never">, number> = {
  "1h": 3_600_000,
  "3h": 3 * 3_600_000,
  "1d": 86_400_000,
  "3d": 3 * 86_400_000,
  "1w": 7 * 86_400_000,
  "1mo": 30 * 86_400_000,
};

function expiresAt(opt: ExpiryOption): string | null {
  if (opt === "never") return null;
  return new Date(Date.now() + EXPIRY_MS[opt]).toISOString();
}

export async function createInvite(input: {
  expiry: ExpiryOption;
  role: "user" | "admin";
  email?: string | null;
  label?: string | null;
  createdBy: string;
}): Promise<InviteRow> {
  const admin = createAdminClient();
  const expires_at = expiresAt(input.expiry);

  // Retry on the (astronomically rare) unique-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from("invite_codes")
      .insert({
        code: generateCode(),
        role: input.role,
        email: input.email ?? null,
        label: input.label ?? null,
        expires_at,
        created_by: input.createdBy,
      })
      .select("*")
      .single();

    if (!error) return enrich(data, null, null);
    if (error.code !== "23505") throw error; // 23505 = unique_violation
  }
  throw new Error("Nu am putut genera un cod unic. Reîncearcă.");
}

// Whether an account already exists for this email (case-insensitive). Used to
// stop someone who already has an account from requesting an invite.
export async function emailHasAccount(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_has_account", {
    p_email: email,
  });
  if (error) throw error;
  return data === true;
}

export async function revokeInvite(id: string): Promise<void> {
  const admin = createAdminClient();
  // Only active codes can be revoked (not used, not already revoked).
  const { error } = await admin
    .from("invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function deleteInvite(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("invite_codes").delete().eq("id", id);
  if (error) throw error;
}

export async function listInvites(): Promise<InviteRow[]> {
  const admin = createAdminClient();
  // Single round-trip: the SQL function joins codes + profiles + auth.users.
  const { data, error } = await admin.rpc("admin_list_invites");
  if (error) throw error;
  return (data ?? []) as InviteRow[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function enrich(r: any, username: string | null, email: string | null): InviteRow {
  return { ...r, used_by_username: username, used_by_email: email } as InviteRow;
}

/* -------------------------------------------------------------------------- */
/* Invite requests (from /cere-invitatie)                                     */
/* -------------------------------------------------------------------------- */

export type InviteRequestStatus = "pending" | "approved" | "rejected";

export type InviteRequestRow = {
  id: string;
  name: string;
  email: string;
  message: string | null;
  ip: string | null;
  status: InviteRequestStatus;
  invite_code_id: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  // resolved (only when approved): the generated code, for display/copy.
  invite_code: string | null;
};

// Insert a pending request. Returns "duplicate" when the email already has a
// pending request (enforced race-safe by the partial unique index), so the
// caller can show a polite message instead of a raw error.
export async function createInviteRequest(input: {
  name: string;
  email: string;
  message: string | null;
  ip: string | null;
}): Promise<"created" | "duplicate"> {
  const admin = createAdminClient();
  const { error } = await admin.from("invite_requests").insert({
    name: input.name,
    email: input.email,
    message: input.message,
    ip: input.ip,
  });
  if (!error) return "created";
  if (error.code === "23505") return "duplicate"; // one-pending-per-email index
  throw error;
}

// Admin list, pending first, then newest first.
export async function listInviteRequests(): Promise<InviteRequestRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_requests")
    .select("*, invite_codes ( code )")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    message: r.message,
    ip: r.ip,
    status: r.status as InviteRequestStatus,
    invite_code_id: r.invite_code_id,
    handled_by: r.handled_by,
    handled_at: r.handled_at,
    created_at: r.created_at,
    invite_code: r.invite_codes?.code ?? null,
  }));
  // pending first (0), everything else keeps created_at-desc order.
  return rows.sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
}

// Approve: generate an invite code (email prefilled, default 1w / user), link
// it to the request, mark approved, and email the requester the code. Returns
// the generated code. Only a pending request can be approved.
export async function approveInviteRequest(
  id: string,
  adminId: string,
): Promise<{ code: string; email: string; name: string }> {
  const admin = createAdminClient();

  const { data: req, error: loadErr } = await admin
    .from("invite_requests")
    .select("email, name, status")
    .eq("id", id)
    .single();
  if (loadErr) throw loadErr;
  if (req.status !== "pending") throw new Error("Cererea nu mai e în așteptare.");

  const invite = await createInvite({
    expiry: "1w",
    role: "user",
    email: req.email,
    createdBy: adminId,
  });

  const { error: updErr } = await admin
    .from("invite_requests")
    .update({
      status: "approved",
      invite_code_id: invite.id,
      handled_by: adminId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (updErr) throw updErr;

  return { code: invite.code, email: req.email, name: req.name };
}

// Reject a pending request (kept in history with status rejected).
export async function rejectInviteRequest(id: string, adminId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("invite_requests")
    .update({
      status: "rejected",
      handled_by: adminId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
}

export async function deleteInviteRequest(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("invite_requests").delete().eq("id", id);
  if (error) throw error;
}
