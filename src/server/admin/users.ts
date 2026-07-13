import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUserSafe, notifyAdminsSafe } from "@/server/notifications/service";
import { formatBytes } from "@/lib/format";

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
  await notifyUserSafe({
    userId: id,
    type: "account_blocked",
    title: "🛡️ Cont blocat",
    body:
      `Contul tău a fost blocat (${BLOCK_LABEL[duration]}).` +
      (reason ? ` Motiv: ${reason}` : ""),
    link: "/profil",
  });
}

export async function unblockUser(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ blocked_reason: null, blocked_until: null })
    .eq("id", id);
  // Also lift any leftover native Supabase ban (from earlier ban-based blocks).
  await admin.auth.admin.updateUserById(id, { ban_duration: "none" });

  await notifyUserSafe({
    userId: id,
    type: "account_unblocked",
    title: "🔓 Cont deblocat",
    body: "Contul tău a fost deblocat. Bine ai revenit!",
    link: "/profil",
  });
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

  await notifyUserSafe({
    userId: id,
    type: "forced_signout",
    title: "📤 Sesiuni deconectate",
    body: "Un administrator a deconectat toate sesiunile contului tău. Va trebui să te autentifici din nou.",
    link: "/profil",
  });
}

// Human value for one limit in the notification copy (null = platform default).
function limitValue(bytes: number | null): string {
  return bytes != null ? formatBytes(bytes) : "implicit";
}

// null = remove the per-user override (falls back to global / unlimited).
export async function setUserLimits(
  id: string,
  limits: { max_file_size: number | null; max_total_size: number | null },
): Promise<void> {
  const admin = createAdminClient();

  // Read the current limits first so the notification names ONLY what actually
  // changed (the form always submits both fields, but usually one was touched).
  const { data: prev } = await admin
    .from("profiles")
    .select("max_file_size, max_total_size")
    .eq("id", id)
    .single();

  const { error } = await admin.from("profiles").update(limits).eq("id", id);
  if (error) throw error;

  const changes: string[] = [];
  if ((prev?.max_total_size ?? null) !== limits.max_total_size) {
    changes.push(`spațiu total: ${limitValue(limits.max_total_size)}`);
  }
  if ((prev?.max_file_size ?? null) !== limits.max_file_size) {
    changes.push(`fișier maxim: ${limitValue(limits.max_file_size)}`);
  }
  // Nothing actually changed — don't notify about a no-op save.
  if (changes.length === 0) return;

  await notifyUserSafe({
    userId: id,
    type: "limits_changed",
    title: "📏 Limite de spațiu actualizate",
    body: `Limite actualizate — ${changes.join("; ")}.`,
    link: "/",
  });
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
    await notifyAdminsSafe({
      type: "block_expired",
      title: "⏰ Blocare expirată",
      body: `Blocarea utilizatorului ${r.username ?? "necunoscut"} a expirat. Contul e din nou activ.`,
      link: "/users",
    });
    await notifyUserSafe({
      userId: r.id,
      type: "block_expired",
      title: "🔓 Blocare expirată",
      body: "Blocarea contului tău a expirat. Contul e din nou activ.",
      link: "/profil",
    });
  }

  return rows.length;
}
