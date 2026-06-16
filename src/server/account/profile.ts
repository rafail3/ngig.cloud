import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const MIN_PASSWORD = 10;

export type LoginDevice = {
  user_agent: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  last_seen: string;
};

export type MyProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  lastSignIn: string | null;
  devices: LoginDevice[];
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
  const { data: devices } = await supabase.rpc("my_login_devices");

  return {
    id,
    email,
    username: profile?.username ?? "",
    role: profile?.role ?? "user",
    created_at: profile?.created_at ?? "",
    lastSignIn: u?.user?.last_sign_in_at ?? null,
    devices: (devices ?? []) as LoginDevice[],
  };
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
  const { supabase, email } = await currentUser();

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
}
