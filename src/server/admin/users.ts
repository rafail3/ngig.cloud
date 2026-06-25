import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminUser = {
  id: string;
  username: string | null;
  email: string | null;
  email_confirmed: boolean;
  role: "user" | "admin";
  account_created: string;
  last_sign_in_at: string | null;
  blocked_until: string | null;
  last_seen_at: string | null;
  last_download_at: string | null;
  max_file_size: number | null;
  max_total_size: number | null;
  blocked_reason: string | null;
  total_size: number;
  file_count: number;
  last_upload_at: string | null;
  last_upload_size: number | null;
  last_city: string | null;
  last_country: string | null;
};

// Block durations the dashboard offers. "permanent" = ~100 years.
export type BlockDuration = "1h" | "24h" | "72h" | "168h" | "720h" | "permanent";

const HOUR = 3600 * 1000;
const BLOCK_MS: Record<BlockDuration, number> = {
  "1h": HOUR,
  "24h": 24 * HOUR,
  "72h": 72 * HOUR,
  "168h": 168 * HOUR,
  "720h": 720 * HOUR,
  permanent: 100 * 365 * 24 * HOUR,
};

export async function listUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_list_users");
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function getUser(id: string): Promise<AdminUser | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

// Revoke all of a user's sessions by id. The JS admin signOut() only takes a
// JWT, so we delete the user's sessions via a security-definer SQL function.
async function revokeSessions(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<void> {
  const { error } = await admin.rpc("admin_sign_out_user", { uid: id });
  if (error) throw error;
}

// Block: set our own block flag + revoke sessions. Enforced by the middleware
// on the user's next request (instant), and by the login action (custom message).
export async function blockUser(
  id: string,
  duration: BlockDuration,
  reason: string | null,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      blocked_reason: reason,
      blocked_until: new Date(Date.now() + BLOCK_MS[duration]).toISOString(),
    })
    .eq("id", id);
  await revokeSessions(admin, id);
}

export async function unblockUser(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ blocked_reason: null, blocked_until: null })
    .eq("id", id);
  // Also lift any leftover native Supabase ban (from earlier ban-based blocks).
  await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
}

// Instant forced sign-out: stamp force_logout_at (middleware rejects older
// tokens) AND delete sessions (kills refresh).
export async function signOutUser(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ force_logout_at: new Date().toISOString() })
    .eq("id", id);
  await revokeSessions(admin, id);
}

// null = remove the per-user override (falls back to global / unlimited).
export async function setUserLimits(
  id: string,
  limits: { max_file_size: number | null; max_total_size: number | null },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(limits).eq("id", id);
  if (error) throw error;
}
