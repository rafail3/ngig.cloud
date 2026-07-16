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

// Tracks WHEN the server last changed between up and down, so the panel can say
// "operational for 3h" or "down for 5m". Stored as one row; only written when
// the state actually flips, so a per-second poll doesn't hammer the table.
//
// It reflects transitions we OBSERVED: an outage that happens while nobody is
// watching is only noticed on the next probe, which is honest — we can't report
// a change we never saw.
const HEALTH_STATE_KEY = "office_health_state";

export type OfficeStateStamp = { state: "up" | "down"; since: number };

export async function recordOfficeState(up: boolean): Promise<OfficeStateStamp> {
  const admin = createAdminClient();
  const state: "up" | "down" = up ? "up" : "down";
  const now = Date.now();

  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", HEALTH_STATE_KEY)
    .maybeSingle();
  const prev = data?.value as Partial<OfficeStateStamp> | undefined;

  if (prev?.state === state && typeof prev.since === "number") {
    return { state, since: prev.since };
  }

  const stamp: OfficeStateStamp = { state, since: now };
  await admin
    .from("app_settings")
    .upsert({ key: HEALTH_STATE_KEY, value: stamp, updated_at: new Date().toISOString() });
  return stamp;
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
