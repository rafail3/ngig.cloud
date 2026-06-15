"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import type { LoginState } from "@/lib/auth-state";

// Admin-only login for the dashboard. Same standard as the main login
// (Turnstile → username→email→signIn) plus an admin role gate: a successful
// password check that isn't an admin is immediately signed out and rejected
// with the same generic error (no hint that admin is required).
export async function dashboardLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const keep = { username, password };

  // Anti-bot gate before any auth work.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!(await verifyTurnstile(token, ip))) {
    return { error: "Verificare anti-bot eșuată. Reîncearcă.", ...keep };
  }

  if (!username || !password) {
    return { error: "Completează username și parolă.", ...keep };
  }

  const admin = createAdminClient();

  // Resolve username -> id -> email (Supabase signs in by email).
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return { error: "Username sau parolă greșite.", ...keep };
  }

  const { data: userRes } = await admin.auth.admin.getUserById(profile.id);
  const email = userRes?.user?.email;
  if (!email) {
    return { error: "Username sau parolă greșite.", ...keep };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Username sau parolă greșite.", ...keep };
  }

  // Admin gate: only admins keep the session. Anyone else is signed out so no
  // dashboard-host session can exist for a non-admin.
  if (profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Username sau parolă greșite.", ...keep };
  }

  // Clean path on the dashboard host; the proxy rewrites "/" → "/dashboard".
  redirect("/");
}
