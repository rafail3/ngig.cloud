import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Global storage settings (bytes; null = unlimited).
export type GlobalSettings = {
  globalMaxFileSize: number | null; // hard cap per file, platform-wide
  defaultUserQuota: number | null; // default per-user total when no override
  globalMaxTotal: number | null; // total bytes across the whole platform
  maxAccounts: number | null; // max number of accounts allowed (null = unlimited)
};

const KEYS = {
  globalMaxFileSize: "global_max_file_size",
  defaultUserQuota: "default_user_quota",
  globalMaxTotal: "global_max_total",
  maxAccounts: "max_accounts",
} as const;

export async function getSettings(): Promise<GlobalSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("key, value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const num = (k: string): number | null => {
    const v = map.get(k);
    return typeof v === "number" ? v : null;
  };
  return {
    globalMaxFileSize: num(KEYS.globalMaxFileSize),
    defaultUserQuota: num(KEYS.defaultUserQuota),
    globalMaxTotal: num(KEYS.globalMaxTotal),
    maxAccounts: num(KEYS.maxAccounts),
  };
}

export async function updateSettings(s: GlobalSettings): Promise<void> {
  const admin = createAdminClient();
  const entries: [string, number | null][] = [
    [KEYS.globalMaxFileSize, s.globalMaxFileSize],
    [KEYS.defaultUserQuota, s.defaultUserQuota],
    [KEYS.globalMaxTotal, s.globalMaxTotal],
    [KEYS.maxAccounts, s.maxAccounts],
  ];
  for (const [key, value] of entries) {
    if (value == null) {
      await admin.from("app_settings").delete().eq("key", key);
    } else {
      await admin
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() });
    }
  }
}
