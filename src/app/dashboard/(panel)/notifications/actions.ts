"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/server/admin/guard";
import {
  setNotificationEnabled,
  setNotificationTemplate,
  resetNotificationTemplate,
} from "@/server/notifications/catalog";

export async function setNotificationEnabledAction(
  type: string,
  enabled: boolean,
): Promise<void> {
  await requireSuperAdmin();
  await setNotificationEnabled(type, enabled);
  revalidatePath("/dashboard/settings");
}

export async function setNotificationTemplateAction(
  type: string,
  title: string,
  body: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const t = title.trim();
  const b = body.trim();
  if (!t) return { error: "Titlul nu poate fi gol." };
  if (!b) return { error: "Mesajul nu poate fi gol." };
  if (t.length > 200) return { error: "Titlul e prea lung (max 200)." };
  if (b.length > 1000) return { error: "Mesajul e prea lung (max 1000)." };
  await setNotificationTemplate(type, t, b);
  revalidatePath("/dashboard/settings");
  return {};
}

export async function resetNotificationTemplateAction(type: string): Promise<void> {
  await requireSuperAdmin();
  await resetNotificationTemplate(type);
  revalidatePath("/dashboard/settings");
}
