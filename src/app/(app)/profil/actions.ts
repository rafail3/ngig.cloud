"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  changeUsername,
  changePassword,
  changeEmail,
  revokeMySession,
  revokeMyOtherSessions,
} from "@/server/account/profile";
import type { AccountState } from "@/lib/account-state";

export async function changeUsernameAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await changeUsername(username, password);
    revalidatePath("/profil");
    return { ok: "Username schimbat." };
  } catch (e) {
    // Echo back the entered values so the inputs aren't cleared on error.
    return { error: e instanceof Error ? e.message : "Eroare.", username, password };
  }
}

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const oldPassword = String(formData.get("oldPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  try {
    await changePassword(oldPassword, newPassword);
    return { ok: "Parolă schimbată." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare.", oldPassword, newPassword };
  }
}

export async function changeEmailAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  try {
    await changeEmail(email, password, origin);
    revalidatePath("/profil");
    return {
      ok: "Email schimbat. Ți-am trimis un link de activare pe noua adresă.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare.", email, password };
  }
}

// Disconnect a single other session by id.
export async function revokeSessionAction(id: string): Promise<void> {
  await revokeMySession(id);
  revalidatePath("/profil");
}

// Disconnect every session except the current one.
export async function revokeOtherSessionsAction(): Promise<void> {
  await revokeMyOtherSessions();
  revalidatePath("/profil");
}
