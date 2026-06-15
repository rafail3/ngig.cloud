"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import { updateSettings } from "@/server/admin/settings";
import { toBytes } from "@/lib/bytes";
import type { SettingsState } from "@/lib/settings-state";

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const get = (name: string) =>
    toBytes(String(formData.get(name) ?? ""), String(formData.get(`${name}Unit`) ?? "GB"));

  let globalMaxFileSize: number | null;
  let defaultUserQuota: number | null;
  let globalMaxTotal: number | null;
  try {
    globalMaxFileSize = get("globalMaxFileSize");
    defaultUserQuota = get("defaultUserQuota");
    globalMaxTotal = get("globalMaxTotal");
  } catch {
    return { error: "Valori invalide (ex: 50 sau 10.5)." };
  }

  try {
    await updateSettings({ globalMaxFileSize, defaultUserQuota, globalMaxTotal });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: "Setări salvate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}
