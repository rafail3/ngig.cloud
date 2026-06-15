import "server-only";
import { randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExpiryOption = "never" | "1h" | "1d" | "3d" | "1w" | "1mo";

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
