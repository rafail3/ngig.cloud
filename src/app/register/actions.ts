"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RegisterState } from "@/lib/auth-state";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerWithInvite(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const code = String(formData.get("code") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const values = { code, username, email, password };

  if (!code || !username || !email) {
    return { error: "Completează toate câmpurile.", values };
  }
  if (!USERNAME_RE.test(username)) {
    return { error: "Username invalid (3-30 caractere: litere, cifre, _).", values };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresă de email invalidă.", values };
  }
  if (password.length < 8) {
    return { error: "Parola trebuie să aibă minim 8 caractere.", values };
  }

  const admin = createAdminClient();

  // 1. Invite code: exists, unused, not expired, email matches (if bound).
  const { data: invite } = await admin
    .from("invite_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .maybeSingle();

  if (!invite) {
    return { error: "Cod de invitație invalid sau deja folosit.", values };
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: "Codul de invitație a expirat.", values };
  }
  if (invite.email && invite.email.toLowerCase() !== email) {
    return { error: "Codul de invitație nu e valid pentru acest email.", values };
  }

  // 2. Username must be free.
  const { data: taken } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (taken) {
    return { error: "Username deja folosit.", values };
  }

  // 3. Create the user (confirmed; metadata feeds the profile trigger).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, role: invite.role },
  });

  if (createErr || !created?.user) {
    return { error: createErr?.message ?? "Eroare la crearea contului.", values };
  }

  // 4. Consume the invite code (single-use).
  await admin
    .from("invite_codes")
    .update({ used_at: new Date().toISOString(), used_by: created.user.id })
    .eq("id", invite.id);

  // 5. Sign in (sets session cookies), then go home.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInErr) {
    redirect("/login");
  }

  redirect("/");
}
