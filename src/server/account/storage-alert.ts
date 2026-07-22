import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/server/admin/settings";
import { notifyUserEvent } from "@/server/notifications/service";
import { sendStorageAlert } from "@/server/email/resend";
import { formatBytes } from "@/lib/format";
import * as repo from "@/server/files/repository";

// The user's self-set storage alert: one threshold on total usage, as a
// percent of their effective quota or an absolute byte count.
export type StorageAlert = {
  mode: "percent" | "absolute";
  value: number;
  fired?: boolean;
};

export function parseStorageAlert(value: unknown): StorageAlert | null {
  if (value == null || typeof value !== "object") return null;
  const v = value as { mode?: unknown; value?: unknown; fired?: unknown };
  if (v.mode !== "percent" && v.mode !== "absolute") return null;
  if (typeof v.value !== "number" || v.value <= 0) return null;
  return { mode: v.mode, value: v.value, fired: v.fired === true };
}

// Evaluate the alert after a usage change (upload confirmed, file deleted,
// trash emptied). Fires bell + email once when the threshold is crossed, and
// re-arms silently when usage drops back under it. Best-effort: call inside
// after(), never on the hot path.
export async function checkStorageAlert(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from("profiles")
      .select("storage_alert, max_total_size")
      .eq("id", userId)
      .single();
    const alert = parseStorageAlert(p?.storage_alert);
    if (!alert) return;

    // Threshold in bytes. Percent mode needs an effective quota to be a
    // percentage OF — without one it simply never fires.
    let threshold: number | null = null;
    if (alert.mode === "absolute") {
      threshold = alert.value;
    } else {
      const quota = p?.max_total_size ?? (await getSettings()).defaultUserQuota ?? null;
      if (quota != null) threshold = Math.floor((quota * alert.value) / 100);
    }
    if (threshold == null || threshold <= 0) return;

    const used = await repo.totalUsage(userId);
    const over = used >= threshold;

    if (over && !alert.fired) {
      const prag =
        alert.mode === "percent" ? `${alert.value}% din cotă` : formatBytes(alert.value);
      await notifyUserEvent(
        userId,
        "storage_alert",
        { folosit: formatBytes(used), prag },
        "/",
      );
      // Email is best-effort on top of the bell.
      try {
        const { data: u } = await admin.auth.admin.getUserById(userId);
        const email = u?.user?.email;
        if (email) await sendStorageAlert({ email, used: formatBytes(used), threshold: prag });
      } catch {
        // bell already delivered
      }
    }

    if (over !== (alert.fired === true)) {
      await admin
        .from("profiles")
        .update({ storage_alert: { mode: alert.mode, value: alert.value, fired: over } })
        .eq("id", userId);
    }
  } catch {
    // non-critical
  }
}
