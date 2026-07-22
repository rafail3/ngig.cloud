"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/server/admin/guard";
import { updateSettings, setSetting, type SettingKey } from "@/server/admin/settings";
import { setUpdateNotifySettings, type UpdateRole } from "@/server/updates/service";
import { setOfficeMode, recordOfficeState } from "@/server/office/config";
import {
  probeDocumentServer,
  getDocumentServerVersion,
  officeServerInfo,
  setOfficeServerUrl,
  setOfficeUrlMode,
  type OfficeProbe,
} from "@/server/office/onlyoffice";
import { toBytes } from "@/lib/bytes";
import { isOfficeServiceMode, isOfficeUrlMode } from "@/lib/office";
import type { SettingsState } from "@/lib/settings-state";

// ── Office server status panel (admin) ───────────────────────────────────────
export type OfficeHealthSample = OfficeProbe & {
  checkedAt: number;
  // Current run: "up"/"down" and the ms epoch it started, for the live
  // "operational for…" / "down for…" readout.
  state: "up" | "down";
  since: number;
  // Duration of the last completed up / down run, ms (if any recorded yet).
  lastUpMs: number | null;
  lastDownMs: number | null;
};

// A single live probe, polled once a second by the status panel.
export async function getOfficeHealthAction(): Promise<OfficeHealthSample> {
  await requireSuperAdmin();
  const probe = await probeDocumentServer();
  const stamp = await recordOfficeState(probe.up);
  return {
    ...probe,
    checkedAt: Date.now(),
    state: stamp.state,
    since: stamp.since,
    lastUpMs: stamp.lastUpMs ?? null,
    lastDownMs: stamp.lastDownMs ?? null,
  };
}

export type OfficeServerInfo = {
  name: string;
  url: string;
  image: string;
  container: string;
  version: string | null;
};

// The server's identity + live version. Fetched once when the panel opens.
export async function getOfficeServerInfoAction(): Promise<OfficeServerInfo> {
  await requireSuperAdmin();
  const [info, version] = await Promise.all([
    officeServerInfo(),
    getDocumentServerVersion(),
  ]);
  return { ...info, version };
}

export async function resetSettingsAction(): Promise<void> {
  await requireSuperAdmin();
  await updateSettings({
    globalMaxFileSize: null,
    defaultUserQuota: null,
    globalMaxTotal: null,
    maxAccounts: null,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

// Where the Document Server's address comes from: whatever the host announces on
// boot (auto), or exactly what an admin typed (manual).
export async function saveOfficeServerUrlAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const urlMode = formData.get("urlMode");
  if (!isOfficeUrlMode(urlMode)) return { error: "Mod invalid." };

  const url = String(formData.get("serverUrl") ?? "").trim();
  if (url && !/^https?:\/\/[^\s/]+/i.test(url)) {
    return { error: "Adresă invalidă (ex: https://ceva.trycloudflare.com)." };
  }
  if (urlMode === "manual" && !url) {
    return { error: "În modul manual trebuie să pui o adresă." };
  }

  try {
    await setOfficeUrlMode(urlMode);
    // In auto mode the host owns the address, so leave whatever it last
    // announced alone unless an admin actually typed something different.
    if (urlMode === "manual" || url) await setOfficeServerUrl(url);
    revalidatePath("/dashboard/settings");
    return {
      ok:
        urlMode === "auto"
          ? "Adresa se ia automat de la server."
          : "Adresă fixată manual.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}

export async function saveOfficeModeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const mode = formData.get("officeMode");
  if (!isOfficeServiceMode(mode)) return { error: "Mod invalid." };

  try {
    await setOfficeMode(mode);
    revalidatePath("/dashboard/settings");
    return { ok: "Mod salvat." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}

const SETTING_KEYS: SettingKey[] = [
  "globalMaxFileSize",
  "defaultUserQuota",
  "globalMaxTotal",
  "maxAccounts",
];

// Save a single global setting (one editable row in the dashboard). Byte fields
// carry a unit; maxAccounts is a plain positive integer. Empty = unlimited.
export async function saveSettingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const field = String(formData.get("field") ?? "") as SettingKey;
  if (!SETTING_KEYS.includes(field)) return { error: "Setare invalidă." };

  const raw = String(formData.get("value") ?? "").trim();
  let value: number | null;
  if (field === "maxAccounts") {
    if (raw === "") value = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        return { error: "Numărul maxim de conturi trebuie să fie un întreg pozitiv." };
      }
      value = n;
    }
  } else {
    try {
      value = toBytes(raw, String(formData.get("unit") ?? "GB"));
    } catch {
      return { error: "Valoare invalidă (ex: 50 sau 10.5)." };
    }
  }

  try {
    await setSetting(field, value);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: "Setare salvată." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}

// The "new version" update notification: toggle + audience.
export async function saveUpdateNotifySettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Acces interzis." };
  }
  const enabled = formData.get("enabled") === "true";
  const audience: UpdateRole[] = [];
  if (formData.get("aud_admin") === "true") audience.push("admin");
  if (formData.get("aud_user") === "true") audience.push("user");
  try {
    await setUpdateNotifySettings({ enabled, audience });
    revalidatePath("/dashboard/settings");
    return { ok: "Setări actualizate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireSuperAdmin();
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

  // Max accounts is a plain positive integer (or empty = unlimited).
  const rawMax = String(formData.get("maxAccounts") ?? "").trim();
  let maxAccounts: number | null = null;
  if (rawMax !== "") {
    const n = Number(rawMax);
    if (!Number.isInteger(n) || n < 0) {
      return { error: "Numărul maxim de conturi trebuie să fie un întreg pozitiv." };
    }
    maxAccounts = n;
  }

  try {
    await updateSettings({ globalMaxFileSize, defaultUserQuota, globalMaxTotal, maxAccounts });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: "Setări salvate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}
