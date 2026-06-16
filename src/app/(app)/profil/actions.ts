"use server";

import { revalidatePath } from "next/cache";
import { changeUsername, changePassword } from "@/server/account/profile";
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
