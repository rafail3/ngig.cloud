// Pure invite status derivation — shared by server and client (no server-only).
export type InviteStatus = "active" | "used" | "expired" | "revoked";

export function inviteStatus(r: {
  revoked_at?: string | null;
  used_at?: string | null;
  expires_at?: string | null;
}): InviteStatus {
  if (r.revoked_at) return "revoked";
  if (r.used_at) return "used";
  if (r.expires_at && new Date(r.expires_at) < new Date()) return "expired";
  return "active";
}

// Result state for the invite-generation form action. Kept here (not in the
// "use server" actions file, which may only export async functions).
export type GenerateState = { error?: string; code?: string };

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  active: "Activ",
  used: "Folosit",
  expired: "Expirat",
  revoked: "Revocat",
};
