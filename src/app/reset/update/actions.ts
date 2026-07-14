"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyUserEvent } from "@/server/notifications/service";
import type { ResetUpdateState } from "@/lib/email-state";

const MIN_PASSWORD = 10;

export async function updatePasswordAction(
  _prev: ResetUpdateState,
  formData: FormData,
): Promise<ResetUpdateState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { error: "Parolele nu coincid." };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Parola trebuie să aibă minim ${MIN_PASSWORD} caractere.` };
  }
  if (!/[A-Z]/.test(password)) return { error: "Parola trebuie să conțină o literă mare." };
  if (!/[a-z]/.test(password)) return { error: "Parola trebuie să conțină o literă mică." };
  if (!/[0-9]/.test(password)) return { error: "Parola trebuie să conțină o cifră." };
  if (!/[^A-Za-z0-9]/.test(password)) return { error: "Parola trebuie să conțină un simbol." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) {
    return { error: "Link expirat. Reia resetarea parolei." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Nu am putut schimba parola. Reia resetarea." };

  await notifyUserEvent(userId, "password_reset", {}, "/profil");

  redirect("/");
}
