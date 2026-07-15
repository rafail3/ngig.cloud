"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  changeUsername,
  changePassword,
  changeEmail,
  revokeMySession,
  revokeMyOtherSessions,
  deleteMyAccount,
  checkMyPassword,
} from "@/server/account/profile";
import type { AccountState } from "@/lib/account-state";

// Used by the delete flow to validate the password on the form, before the
// point-of-no-return prompt. The deletion itself re-checks server-side.
export async function verifyMyPasswordAction(
  password: string,
): Promise<{ ok: boolean }> {
  try {
    return { ok: await checkMyPassword(password) };
  } catch {
    return { ok: false };
  }
}

// Wipes the caller's account for good. The client sends the browser to /login
// on success — the auth user no longer exists, so the session cookie is dead and
// a full load is the cleanest way to drop every cached page.
export async function deleteMyAccountAction(input: {
  password: string;
  username: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteMyAccount(input.password, input.username);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare." };
  }
}

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
