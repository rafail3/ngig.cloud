import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOfficeServiceMode,
  type OfficeServiceMode,
  type OfficeStatus,
} from "@/lib/office";
import {
  isDocumentServerUp,
  isOfficeEditingConfigured,
  getOfficeServerUrl,
} from "./onlyoffice";

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

export type OfficeStateStamp = {
  state: "up" | "down";
  since: number;
  // Duration of the LAST completed run of each state, ms — so the panel can
  // show "was up for 3h" while it's down, and vice-versa.
  lastUpMs?: number;
  lastDownMs?: number;
};

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

  // Same state as before → still running; carry everything forward untouched.
  if (prev?.state === state && typeof prev.since === "number") {
    return {
      state,
      since: prev.since,
      lastUpMs: prev.lastUpMs,
      lastDownMs: prev.lastDownMs,
    };
  }

  // A transition (or the first record). The run that just ended becomes the
  // "last" duration for whichever state it was.
  let lastUpMs = prev?.lastUpMs;
  let lastDownMs = prev?.lastDownMs;
  if (prev?.state && typeof prev.since === "number") {
    const ended = now - prev.since;
    if (prev.state === "up") lastUpMs = ended;
    else lastDownMs = ended;
  }

  const stamp: OfficeStateStamp = { state, since: now };
  if (lastUpMs != null) stamp.lastUpMs = lastUpMs;
  if (lastDownMs != null) stamp.lastDownMs = lastDownMs;

  await admin
    .from("app_settings")
    .upsert({ key: HEALTH_STATE_KEY, value: stamp, updated_at: new Date().toISOString() });
  return stamp;
}

// The full picture the client needs to decide how to preview and whether to
// offer editing. The health check is skipped when it can't matter — no server
// configured, or a mode that never uses it — so those paths cost nothing.
export async function getOfficeStatus(): Promise<OfficeStatus> {
  const [configured, mode, dsUrl] = await Promise.all([
    isOfficeEditingConfigured(),
    getOfficeMode(),
    getOfficeServerUrl(),
  ]);
  const needsHealth = configured && mode !== "legacy";
  const up = needsHealth ? await isDocumentServerUp() : false;
  return { mode, up, configured, dsUrl };
}
