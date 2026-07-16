import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOfficeServiceMode,
  type OfficeServiceMode,
  type OfficeStatus,
} from "@/lib/office";
import { isDocumentServerUp, isOfficeEditingConfigured } from "./onlyoffice";

// The admin's chosen Office service mode, stored as a single row in the shared
// app_settings key/value table (same place as the storage limits).
const MODE_KEY = "office_service_mode";
const DEFAULT_MODE: OfficeServiceMode = "auto";

export async function getOfficeMode(): Promise<OfficeServiceMode> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", MODE_KEY)
    .maybeSingle();
  return isOfficeServiceMode(data?.value) ? data.value : DEFAULT_MODE;
}

export async function setOfficeMode(mode: OfficeServiceMode): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("app_settings")
    .upsert({ key: MODE_KEY, value: mode, updated_at: new Date().toISOString() });
}

// The full picture the client needs to decide how to preview and whether to
// offer editing. The health check is skipped when it can't matter — no server
// configured, or a mode that never uses it — so those paths cost nothing.
export async function getOfficeStatus(): Promise<OfficeStatus> {
  const configured = isOfficeEditingConfigured();
  const mode = await getOfficeMode();
  const needsHealth = configured && mode !== "legacy";
  const up = needsHealth ? await isDocumentServerUp() : false;
  return { mode, up, configured };
}
