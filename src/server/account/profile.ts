import "server-only";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { emailHasAccount } from "@/server/invites/service";
import { sendEmailChangedNotice, sendEmailActivation } from "@/server/email/resend";
import { notifyUserSafe } from "@/server/notifications/service";

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
    .select("username, role, created_at")
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
    created_at: profile?.created_at ?? "",
    lastSignIn: u?.user?.last_sign_in_at ?? null,
  };
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

  await notifyUserSafe({
    userId: id,
    type: "password_changed",
    title: "🔒 Parolă schimbată",
    body: "Parola contului tău a fost schimbată. Dacă nu ai fost tu, resetează-ți parola imediat.",
    link: "/profil",
  });
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

  await notifyUserSafe({
    userId: id,
    type: "email_change_sent",
    title: "✉️ Confirmă noua adresă de email",
    body: `Ți-am trimis un link de activare pe ${email}. Confirmă-l pentru a finaliza schimbarea.`,
    link: "/profil",
  });
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
    await notifyUserSafe({
      userId: activated,
      type: "email_activated",
      title: "✅ Email confirmat",
      body: "Noua ta adresă de email a fost activată cu succes.",
      link: "/profil",
    });
  }
  return (data?.length ?? 0) > 0;
}
