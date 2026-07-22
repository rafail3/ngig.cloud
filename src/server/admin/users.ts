import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUserEvent, notifyAdminsEvent } from "@/server/notifications/service";
import { wipeUserData, assertNotLastAdmin } from "@/server/account/wipe";
import { formatBytes } from "@/lib/format";

export type AdminUser = {
  id: string;
  username: string | null;
  email: string | null;
  email_confirmed: boolean;
  role: "user" | "admin";
  is_super_admin: boolean;
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

// Human labels for the notification copy the blocked user sees.
const BLOCK_LABEL: Record<BlockDuration, string> = {
  "1h": "1 oră",
  "24h": "24 de ore",
  "72h": "3 zile",
  "168h": "7 zile",
  "720h": "30 de zile",
  permanent: "permanent",
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

  // The user is signed out now, but the notification waits in their feed for the
  // next time they can log in (permanent blocks aside).
  await notifyUserEvent(
    id,
    "account_blocked",
    { durata: BLOCK_LABEL[duration], motiv: reason ? ` Motiv: ${reason}` : "" },
    "/profil",
  );
}

export async function unblockUser(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ blocked_reason: null, blocked_until: null })
    .eq("id", id);
  // Also lift any leftover native Supabase ban (from earlier ban-based blocks).
  await admin.auth.admin.updateUserById(id, { ban_duration: "none" });

  await notifyUserEvent(id, "account_unblocked", {}, "/profil");
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

  await notifyUserEvent(id, "forced_signout", {}, "/profil");
}

// Admin-side account deletion — the same total wipe as the self-service flow
// (wipeUserData). Irreversible.
//
// `usernameConfirmation` must equal the target's username and is checked HERE,
// server-side and before anything is touched: a client-side-only check would be
// a suggestion, and the cost of getting the order wrong is someone else's data.
// Returns the username so the caller can name it in the confirmation.
export async function deleteUserAccount(
  id: string,
  usernameConfirmation: string,
  actorId?: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Utilizator inexistent.");
  const username = data.username as string;

  if (usernameConfirmation.trim() !== username) {
    throw new Error("Username-ul tastat nu se potrivește.");
  }
  await assertNotLastAdmin(id);
  await wipeUserData(id, actorId);
  return username;
}

// null = remove the per-user override (falls back to global / unlimited).
export async function setUserLimits(
  id: string,
  limits: { max_file_size: number | null; max_total_size: number | null },
): Promise<void> {
  const admin = createAdminClient();

  // Read the current limits first so the notification describes ONLY what
  // actually changed (the form always submits both fields, but usually one was
  // touched).
  const { data: prev } = await admin
    .from("profiles")
    .select("max_file_size, max_total_size")
    .eq("id", id)
    .single();

  const { error } = await admin.from("profiles").update(limits).eq("id", id);
  if (error) throw error;

  // One clause per changed limit, combined into a single professional sentence.
  const clauses: string[] = [];
  if ((prev?.max_total_size ?? null) !== limits.max_total_size) {
    clauses.push(
      limits.max_total_size != null
        ? `spațiul total la ${formatBytes(limits.max_total_size)}`
        : "spațiul total la valoarea implicită",
    );
  }
  if ((prev?.max_file_size ?? null) !== limits.max_file_size) {
    clauses.push(
      limits.max_file_size != null
        ? `maximum ${formatBytes(limits.max_file_size)} per fișier`
        : "dimensiunea per fișier la valoarea implicită",
    );
  }
  // Nothing actually changed — don't notify about a no-op save.
  if (clauses.length === 0) return;

  await notifyUserEvent(id, "limits_changed", { detalii: clauses.join(" și ") }, "/");
}

// Change a user's role (user ↔ admin). Demoting an admin is guarded so the
// platform is never left without one. The affected user is notified in-app; the
// new role takes effect on their next request (the dashboard gate + middleware
// re-read the role), so no session revoke is needed.
export async function setUserRole(id: string, role: "user" | "admin"): Promise<void> {
  const admin = createAdminClient();
  const { data: prev } = await admin
    .from("profiles")
    .select("role, is_super_admin")
    .eq("id", id)
    .maybeSingle();
  if (!prev) throw new Error("Utilizator inexistent.");
  // The master admin (owner) can't be demoted/altered by anyone.
  if (prev.is_super_admin) throw new Error("Rolul master admin-ului nu poate fi schimbat.");
  if (prev.role === role) return; // no-op

  if (prev.role === "admin" && role === "user") {
    await assertNotLastAdmin(id);
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;

  await notifyUserEvent(
    id,
    "role_changed",
    { rol: role === "admin" ? "manager" : "utilizator" },
    "/",
  );
}

// Cron-only: find time-limited blocks that have lapsed (blocked_until in the
// past, still flagged), clear the stale flags, and notify both the admins (as a
// platform-status event) and the affected user. Permanent blocks sit ~100 years
// in the future so they're never caught here. Runs without a user session.
export async function expireBlocks(): Promise<number> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from("profiles")
    .select("id, username")
    .not("blocked_until", "is", null)
    .lt("blocked_until", nowIso);
  if (error) throw error;

  const rows = (data ?? []) as { id: string; username: string | null }[];
  if (rows.length === 0) return 0;

  await admin
    .from("profiles")
    .update({ blocked_until: null, blocked_reason: null })
    .in(
      "id",
      rows.map((r) => r.id),
    );

  for (const r of rows) {
    await notifyAdminsEvent(
      "block_expired_admin",
      { utilizator: r.username ?? "necunoscut" },
      "/users",
    );
    await notifyUserEvent(r.id, "block_expired", {}, "/profil");
  }

  return rows.length;
}
