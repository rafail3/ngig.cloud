"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import {
  blockUser,
  unblockUser,
  signOutUser,
  setUserLimits,
  type BlockDuration,
} from "@/server/admin/users";
import type { UserActionState } from "@/lib/user-presence";

const DURATIONS: BlockDuration[] = ["1h", "24h", "72h", "168h", "720h", "permanent"];
const MB = 1024 * 1024;
const GB = 1024 * MB;

function refresh(id: string) {
  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${id}`);
}

export async function blockUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "User invalid." };
  if (id === adminId) return { error: "Nu te poți bloca pe tine însuți." };

  const duration = String(formData.get("duration") ?? "") as BlockDuration;
  if (!DURATIONS.includes(duration)) return { error: "Durată invalidă." };

  const reason = String(formData.get("reason") ?? "").trim() || null;

  try {
    await blockUser(id, duration, reason);
    refresh(id);
    return { ok: "User blocat." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la blocare." };
  }
}

export async function unblockUserAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await unblockUser(id);
  refresh(id);
}

export async function signOutUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Acces interzis." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "User invalid." };
  try {
    await signOutUser(id);
    refresh(id);
    return { ok: "Sesiuni invalidate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la sign out." };
  }
}

export async function resetUserLimitsAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await setUserLimits(id, { max_file_size: null, max_total_size: null });
  refresh(id);
}

export async function setUserLimitsAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "User invalid." };

  const parse = (raw: string, unit: string): number | null => {
    const v = raw.trim();
    if (v === "") return null; // empty = unlimited
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error("invalid");
    const mult = unit === "MB" ? MB : GB;
    return Math.round(n * mult);
  };

  let max_file_size: number | null;
  let max_total_size: number | null;
  try {
    max_file_size = parse(
      String(formData.get("maxFile") ?? ""),
      String(formData.get("maxFileUnit") ?? "GB"),
    );
    max_total_size = parse(
      String(formData.get("maxTotal") ?? ""),
      String(formData.get("maxTotalUnit") ?? "GB"),
    );
  } catch {
    return { error: "Valori invalide (ex: 2 sau 10.5)." };
  }

  try {
    await setUserLimits(id, { max_file_size, max_total_size });
    refresh(id);
    return { ok: "Limite actualizate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}
