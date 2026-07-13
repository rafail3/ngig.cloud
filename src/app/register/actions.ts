"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyUserSafe, notifyAdminsSafe } from "@/server/notifications/service";
import type { RegisterState } from "@/lib/auth-state";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

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

  // Anti-bot gate before any account work. createUser uses the admin API which
  // bypasses Supabase's own captcha, so we verify the token ourselves here.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!(await verifyTurnstile(token, ip))) {
    return { error: "Verificare anti-bot eșuată. Reîncearcă.", values };
  }

  if (!code || !username || !email) {
    return { error: "Completează toate câmpurile.", values };
  }
  if (!USERNAME_RE.test(username)) {
    return { error: "Username invalid (3-30 caractere: litere, cifre, _).", values };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresă de email invalidă.", values };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Parola trebuie să aibă minim ${MIN_PASSWORD} caractere.`, values };
  }
  if (!/[A-Z]/.test(password)) {
    return { error: "Parola trebuie să conțină o literă mare.", values };
  }
  if (!/[a-z]/.test(password)) {
    return { error: "Parola trebuie să conțină o literă mică.", values };
  }
  if (!/[0-9]/.test(password)) {
    return { error: "Parola trebuie să conțină o cifră.", values };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { error: "Parola trebuie să conțină un simbol.", values };
  }

  const admin = createAdminClient();

  // 1. Invite code: exists, unused, not revoked, not expired, email matches (if bound).
  const { data: invite } = await admin
    .from("invite_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .is("revoked_at", null)
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
    // Map Supabase's English errors to our own copy — never surface raw internals.
    const m = createErr?.message?.toLowerCase() ?? "";
    const msg =
      m.includes("already") || m.includes("registered") || m.includes("exists")
        ? "Există deja un cont cu acest email."
        : "Nu am putut crea contul. Reîncearcă.";
    return { error: msg, values };
  }

  // 4. Consume the invite code (single-use).
  await admin
    .from("invite_codes")
    .update({ used_at: new Date().toISOString(), used_by: created.user.id })
    .eq("id", invite.id);

  // Welcome the new user + let the admins know a new account was created.
  // Best-effort: never block registration on a notification.
  await notifyUserSafe({
    userId: created.user.id,
    type: "welcome",
    title: "🎉 Bine ai venit pe ngig.cloud!",
    body: "Contul tău e gata. Încarcă-ți primele fișiere și explorează-ți cloud-ul.",
    link: "/",
  });
  await notifyAdminsSafe({
    type: "user_registered",
    title: "🎉 Utilizator nou",
    body: `${username} (${email}) și-a creat un cont.`,
    link: "/users",
  });

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
