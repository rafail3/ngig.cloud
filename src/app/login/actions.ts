"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LoginState } from "@/lib/auth-state";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Keep what the user typed so the form can repopulate on error.
  const keep = { username, password };

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

  redirect("/");
}
