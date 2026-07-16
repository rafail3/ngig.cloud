"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import { updateSettings } from "@/server/admin/settings";
import { setOfficeMode } from "@/server/office/config";
import {
  probeDocumentServer,
  getDocumentServerVersion,
  officeServerInfo,
  type OfficeProbe,
} from "@/server/office/onlyoffice";
import { toBytes } from "@/lib/bytes";
import { isOfficeServiceMode } from "@/lib/office";
import type { SettingsState } from "@/lib/settings-state";

// ── Office server status panel (admin) ───────────────────────────────────────
export type OfficeHealthSample = OfficeProbe & { checkedAt: number };

// A single live probe, polled once a second by the status panel.
export async function getOfficeHealthAction(): Promise<OfficeHealthSample> {
  await requireAdmin();
  const probe = await probeDocumentServer();
  return { ...probe, checkedAt: Date.now() };
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
  await requireAdmin();
  const info = officeServerInfo();
  const version = await getDocumentServerVersion();
  return { ...info, version };
}

export async function resetSettingsAction(): Promise<void> {
  await requireAdmin();
  await updateSettings({
    globalMaxFileSize: null,
    defaultUserQuota: null,
    globalMaxTotal: null,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function saveOfficeModeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireAdmin();
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
