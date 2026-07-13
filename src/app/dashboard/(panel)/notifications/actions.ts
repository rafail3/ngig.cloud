"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import { setNotificationEnabled } from "@/server/notifications/catalog";

export async function setNotificationEnabledAction(
  type: string,
  enabled: boolean,
): Promise<void> {
  await requireAdmin();
  await setNotificationEnabled(type, enabled);
  revalidatePath("/dashboard/settings");
}
