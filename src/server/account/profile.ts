import "server-only";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { emailHasAccount } from "@/server/invites/service";
import { sendEmailChangedNotice, sendEmailActivation } from "@/server/email/resend";
import { notifyUserEvent } from "@/server/notifications/service";
import { wipeUserData, assertNotLastAdmin } from "@/server/account/wipe";
import { getSettings } from "@/server/admin/settings";
import { parseStorageAlert } from "@/server/account/storage-alert";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

// A real, revocable auth session (one per device login), enriched with the
// browser UA + geo from login_audit. `is_current` marks the caller's own session.
export type ActiveSession = {
  id: string;
  created_at: string;
  last_seen: string;
  user_agent: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  is_current: boolean;
};

export type MyProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  created_at: string;
  lastSignIn: string | null;
};

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  const email = (data?.claims?.email as string | undefined) ?? "";
  if (!id) throw new Error("Neautentificat.");
  return { supabase, id, email };
}

export async function getMyProfile(): Promise<MyProfile> {
  const { supabase, id, email } = await currentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, is_super_admin, created_at")
    .eq("id", id)
    .single();

  const admin = createAdminClient();
  const { data: u } = await admin.auth.admin.getUserById(id);

  return {
    id,
    // Fresh from auth (the JWT claim can lag right after an email change).
    email: u?.user?.email ?? email,
    username: profile?.username ?? "",
    role: profile?.role ?? "user",
    isSuperAdmin: profile?.is_super_admin ?? false,
    created_at: profile?.created_at ?? "",
    lastSignIn: u?.user?.last_sign_in_at ?? null,
  };
}

// The caller's storage picture for the profile page: whether an admin total
// quota applies (per-user or the global default — it always wins), their own
// total cap, the effective quota (admin, else self), and their alert config.
export type MyStorageSettings = {
  adminQuota: number | null; // admin total quota (null = none)
  selfMaxTotal: number | null;
  effectiveQuota: number | null; // adminQuota ?? selfMaxTotal — funds the % alert
  alert: { mode: "percent" | "absolute"; value: number } | null;
};

export async function getMyStorageSettings(): Promise<MyStorageSettings> {
  const { supabase, id } = await currentUser();
  const [{ data: p }, settings] = await Promise.all([
    supabase
      .from("profiles")
      .select("max_total_size, self_max_total_size, storage_alert")
      .eq("id", id)
      .single(),
    getSettings(),
  ]);
  const adminQuota = p?.max_total_size ?? settings.defaultUserQuota ?? null;
  const selfMaxTotal = p?.self_max_total_size ?? null;
  const alertRaw = parseStorageAlert(p?.storage_alert);
  return {
    adminQuota,
    selfMaxTotal,
    effectiveQuota: adminQuota ?? selfMaxTotal,
    alert: alertRaw ? { mode: alertRaw.mode, value: alertRaw.value } : null,
  };
}

// Set (or clear, with null) the caller's own TOTAL storage cap. Refused while
// an admin quota applies — that one always wins and the UI explains it.
export async function setMySelfMaxTotal(bytes: number | null): Promise<void> {
  const { supabase, id } = await currentUser();
  if (bytes != null && (!Number.isFinite(bytes) || bytes <= 0)) {
    throw new Error("Valoare invalidă.");
  }
  const current = await getMyStorageSettings();
  if (current.adminQuota != null) {
    throw new Error("Cota de stocare e stabilită de administrator — nu poate fi modificată.");
  }
  const { error } = await supabase
    .from("profiles")
    .update({ self_max_total_size: bytes })
    .eq("id", id);
  if (error) throw error;
}

// Set (or clear) the caller's storage alert. Resets the fired flag so a new
// threshold is evaluated fresh on the next usage change.
export async function setMyStorageAlert(
  alert: { mode: "percent" | "absolute"; value: number } | null,
): Promise<void> {
  const { supabase, id } = await currentUser();
  if (alert) {
    if (!Number.isFinite(alert.value) || alert.value <= 0) throw new Error("Valoare invalidă.");
    if (alert.mode === "percent" && (alert.value < 1 || alert.value > 100)) {
      throw new Error("Procentul trebuie să fie între 1 și 100.");
    }
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      storage_alert: alert ? { mode: alert.mode, value: alert.value, fired: false } : null,
    })
    .eq("id", id);
  if (error) throw error;
}

// Real active sessions for the caller (revocable). Uses the user's own client
// so auth.uid() / the session_id JWT claim resolve to them.
export async function listMySessions(): Promise<ActiveSession[]> {
  const { supabase } = await currentUser();
  const { data, error } = await supabase.rpc("my_sessions");
  if (error) throw error;
  return (data ?? []) as ActiveSession[];
}

// Revoke one other session by id (the SQL guards against killing the current
// one and against touching other users' sessions).
export async function revokeMySession(id: string): Promise<void> {
  const { supabase } = await currentUser();
  const { error } = await supabase.rpc("revoke_my_session", { sid: id });
  if (error) throw error;
}

// Revoke every session except the caller's current one.
export async function revokeMyOtherSessions(): Promise<void> {
  const { supabase } = await currentUser();
  const { error } = await supabase.rpc("revoke_my_other_sessions");
  if (error) throw error;
}

// Verify a password without touching the user's session — a throwaway client
// that never persists. Used to re-authenticate before sensitive changes.
async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false;
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  // signInWithPassword creates a server-side session. Revoke ONLY this probe
  // session (scope: local) — global would kill the user's real session too.
  if (!error) await probe.auth.signOut({ scope: "local" });
  return !error;
}

// Is this the caller's password? Lets the delete flow reject a wrong password on
// the form itself, instead of dragging the user through the final confirmation
// only to fail there. deleteMyAccount re-checks it anyway — this is a courtesy,
// not the gate.
export async function checkMyPassword(password: string): Promise<boolean> {
  const { email } = await currentUser();
  return verifyPassword(email, password);
}

// Self-service account deletion. Irreversible: it wipes the B2 objects and then
// the auth user, whose cascade clears every row (see wipeUserData).
//
// Two proofs are required before anything is touched: the current password (it's
// really them, not a hijacked tab) and the username typed by hand (they meant
// it, not a stray click on an autofilled form).
export async function deleteMyAccount(
  password: string,
  usernameConfirmation: string,
): Promise<void> {
  const { supabase, id, email } = await currentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", id)
    .single();
  const username = (profile?.username as string) ?? "";

  if (usernameConfirmation.trim() !== username) {
    throw new Error("Username-ul tastat nu se potrivește.");
  }
  if (!(await verifyPassword(email, password))) {
    throw new Error("Parola e greșită.");
  }
  // A cloud with no admin can only be fixed by hand in Supabase.
  await assertNotLastAdmin(id);

  // Sign out BEFORE the wipe, while the account still exists: signOut is what
  // clears the auth cookies, and it can only do that cleanly against a live
  // user. Skipping this left the browser holding a still-valid JWT for an
  // account that no longer existed. The wipe below runs on the admin client and
  // needs no session of its own.
  await supabase.auth.signOut({ scope: "local" });

  await wipeUserData(id, id);
}

export async function changeUsername(
  newUsername: string,
  currentPassword: string,
): Promise<void> {
  const { supabase, id, email } = await currentUser();
  const username = newUsername.trim();

  if (!USERNAME_RE.test(username)) {
    throw new Error("Username invalid (3-30 caractere: litere, cifre, _).");
  }
  if (!(await verifyPassword(email, currentPassword))) {
    throw new Error("Parola curentă e greșită.");
  }

  const { error } = await supabase.from("profiles").update({ username }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Username deja folosit.");
    throw error;
  }
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const { supabase, id, email } = await currentUser();

  if (!(await verifyPassword(email, oldPassword))) {
    throw new Error("Parola veche e greșită.");
  }
  if (newPassword.length < MIN_PASSWORD) {
    throw new Error(`Parola nouă trebuie să aibă minim ${MIN_PASSWORD} caractere.`);
  }
  if (!/[A-Z]/.test(newPassword)) throw new Error("Parola nouă trebuie să conțină o literă mare.");
  if (!/[a-z]/.test(newPassword)) throw new Error("Parola nouă trebuie să conțină o literă mică.");
  if (!/[0-9]/.test(newPassword)) throw new Error("Parola nouă trebuie să conțină o cifră.");
  if (!/[^A-Za-z0-9]/.test(newPassword)) throw new Error("Parola nouă trebuie să conțină un simbol.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error("Nu am putut schimba parola. Reîncearcă.");

  await notifyUserEvent(id, "password_changed", {}, "/profil");
}

// Change the account email. Applies immediately (login is by username, so a
// wrong email can't lock anyone out), then sends a security notice to the old
// address and an activation link to the new one. Until activated, the new email
// is flagged unconfirmed (admin user-detail shows a warning).
export async function changeEmail(
  newEmail: string,
  currentPassword: string,
  origin: string,
): Promise<void> {
  const { id, email: oldEmail } = await currentUser();
  const email = newEmail.trim().toLowerCase();

  if (!EMAIL_RE.test(email)) throw new Error("Adresă de email invalidă.");
  if (email === oldEmail.toLowerCase()) {
    throw new Error("E același email cu cel actual.");
  }
  if (!(await verifyPassword(oldEmail, currentPassword))) {
    throw new Error("Parola curentă e greșită.");
  }
  if (await emailHasAccount(email)) {
    throw new Error("Există deja un cont cu acest email.");
  }

  const admin = createAdminClient();

  // Apply immediately; email_confirm keeps Supabase from running its own
  // confirmation flow — we run our own activation below.
  const { error: updErr } = await admin.auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
  });
  if (updErr) {
    const m = updErr.message?.toLowerCase() ?? "";
    throw new Error(
      m.includes("already") || m.includes("registered") || m.includes("exists")
        ? "Există deja un cont cu acest email."
        : "Nu am putut schimba emailul. Reîncearcă.",
    );
  }

  // Flag the new address unconfirmed until activated via the emailed token.
  const token = randomBytes(32).toString("hex");
  await admin
    .from("profiles")
    .update({ email_confirmed: false, email_confirm_token: token })
    .eq("id", id);

  // Notice to the old address + activation link to the new one. Best-effort —
  // a mail failure must not undo the change that already applied.
  try {
    await sendEmailChangedNotice({ oldEmail, newEmail: email });
  } catch {
    // non-critical
  }
  try {
    await sendEmailActivation({ email, token, origin });
  } catch {
    // non-critical
  }

  await notifyUserEvent(id, "email_change_sent", { email }, "/profil");
}

// Activate a changed email via its one-time token (from the activation link).
// Returns true if a matching pending token was found and cleared.
export async function confirmEmailToken(token: string): Promise<boolean> {
  const clean = token.trim();
  if (!clean) return false;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ email_confirmed: true, email_confirm_token: null })
    .eq("email_confirm_token", clean)
    .select("id");
  if (error) throw error;
  const activated = data?.[0]?.id as string | undefined;
  if (activated) {
    await notifyUserEvent(activated, "email_activated", {}, "/profil");
  }
  return (data?.length ?? 0) > 0;
}
