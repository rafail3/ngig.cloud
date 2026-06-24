"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { recordLogin } from "@/server/admin/audit";
import { blockMessage } from "@/lib/block-message";
import type { LoginState } from "@/lib/auth-state";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Keep what the user typed so the form can repopulate on error.
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

  // Resolve username -> user id -> email (Supabase signs in by email).
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
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

  // Password is correct — only now is it safe to reveal a block (to the owner).
  const { data: blk } = await admin
    .from("profiles")
    .select("blocked_until")
    .eq("id", profile.id)
    .maybeSingle();
  if (blk?.blocked_until && new Date(blk.blocked_until) > new Date()) {
    await supabase.auth.signOut();
    return { error: blockMessage(blk.blocked_until), ...keep };
  }

  // Stamp the new session's id on the login record so the profile page can show
  // this session with its real device/IP/geo.
  const { data: claims } = await supabase.auth.getClaims();
  const sessionId = (claims?.claims?.session_id as string | undefined) ?? null;
  await recordLogin(profile.id, await headers(), sessionId, "cloud");
  redirect("/");
}
