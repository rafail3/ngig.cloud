"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import {
  blockUser,
  unblockUser,
  signOutUser,
  setUserLimits,
  setUserRole,
  deleteUserAccount,
  type BlockDuration,
} from "@/server/admin/users";
import type { UserActionState } from "@/lib/user-presence";
import { toBytes } from "@/lib/bytes";

const DURATIONS: BlockDuration[] = ["1h", "24h", "72h", "168h", "720h", "permanent"];

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

// Wipes a user completely (B2 + every row). Irreversible, so the caller must
// echo back the exact username — the same lock the self-service flow uses.
// Deleting yourself from here is refused: that belongs on your own profile,
// where re-authentication happens.
export async function deleteUserAction(input: {
  id: string;
  username: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { ok: false, error: "Acces interzis." };
  }
  if (!input.id) return { ok: false, error: "User invalid." };
  if (input.id === adminId) {
    return { ok: false, error: "Îți poți șterge propriul cont doar din pagina ta de profil." };
  }

  try {
    // The confirmation is validated inside, before the wipe.
    await deleteUserAccount(input.id, input.username, adminId);
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare la ștergere." };
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

export async function setUserRoleAction(
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
  const role = String(formData.get("role") ?? "");
  if (!id) return { error: "User invalid." };
  if (id === adminId) return { error: "Nu-ți poți schimba propriul rol de aici." };
  if (role !== "user" && role !== "admin") return { error: "Rol invalid." };

  try {
    await setUserRole(id, role);
    refresh(id);
    return { ok: role === "admin" ? "User promovat la administrator." : "User setat ca utilizator." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la schimbarea rolului." };
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

  let max_file_size: number | null;
  let max_total_size: number | null;
  try {
    max_file_size = toBytes(
      String(formData.get("maxFile") ?? ""),
      String(formData.get("maxFileUnit") ?? "GB"),
    );
    max_total_size = toBytes(
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
