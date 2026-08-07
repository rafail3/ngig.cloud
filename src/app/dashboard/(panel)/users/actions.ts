"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireSection,
  requireSuperAdmin,
  assertCanManageTarget,
  DASHBOARD_SECTIONS,
} from "@/server/admin/guard";
import {
  blockUser,
  unblockUser,
  signOutUser,
  setUserLimits,
  setUserRole,
  setManagerSections,
  deleteUserAccount,
  type BlockDuration,
} from "@/server/admin/users";
import { getUserActivity, type UserActivityDetail } from "@/server/admin/stats";
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
    adminId = await requireSection("users");
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
    await assertCanManageTarget(adminId, id);
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
/* Deleting an account navigates away from the page it was deleted on, and the
   navigation has to be the SERVER's, not the client's.

   The page this runs from is `/users/[id]`, which calls `notFound()` when the
   user does not exist. Revalidating and then pushing from the client raced
   with that: the action's revalidation made the router re-render the route it
   was still on, that render found no user and threw a 404, and the 404 landed
   on top of the push — so you ended up at /users looking at a not-found page
   that a manual reload then fixed.

   `redirect()` removes the race by construction: it terminates the segment and
   answers the action with a navigation, so the doomed page is never rendered
   again. It must sit OUTSIDE the try — it works by throwing, and the catch
   below would swallow it and report it as a deletion failure. */
export async function deleteUserAction(input: {
  id: string;
  username: string;
}): Promise<{ ok: false; error: string }> {
  let adminId: string;
  try {
    adminId = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Acces interzis. Doar super admin." };
  }
  if (!input.id) return { ok: false, error: "User invalid." };
  if (input.id === adminId) {
    return { ok: false, error: "Îți poți șterge propriul cont doar din pagina ta de profil." };
  }

  try {
    // The confirmation is validated inside, before the wipe.
    await deleteUserAccount(input.id, input.username, adminId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare la ștergere." };
  }

  revalidatePath("/dashboard/users");
  // Prefix-free, like every other dashboard path — the proxy rewrites it onto
  // the /dashboard tree. The name rides along so the list can confirm what was
  // deleted; the client can no longer toast it itself, since a redirect means
  // nothing after the await ever runs.
  redirect(`/users?sters=${encodeURIComponent(input.username)}`);
}

export async function unblockUserAction(formData: FormData) {
  const adminId = await requireSection("users");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await assertCanManageTarget(adminId, id);
  await unblockUser(id);
  refresh(id);
}

export async function signOutUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let adminId: string;
  try {
    adminId = await requireSection("users");
  } catch {
    return { error: "Acces interzis." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "User invalid." };
  try {
    await assertCanManageTarget(adminId, id);
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
    adminId = await requireSuperAdmin();
  } catch {
    return { error: "Acces interzis. Doar super admin." };
  }

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!id) return { error: "User invalid." };
  if (id === adminId) return { error: "Nu-ți poți schimba propriul rol de aici." };
  if (role !== "user" && role !== "admin") return { error: "Rol invalid." };

  try {
    await setUserRole(id, role);
    refresh(id);
    return { ok: role === "admin" ? "User promovat la manager." : "User setat ca utilizator." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la schimbarea rolului." };
  }
}

// Per-user activity detail for the Overview leaderboard's insights modal.
// Section-gated on "users" (same as the leaderboard); the window is validated.
export async function getUserActivityAction(
  userId: string,
  days: number,
): Promise<{ ok: true; data: UserActivityDetail } | { ok: false; error: string }> {
  try {
    await requireSection("users");
  } catch {
    return { ok: false, error: "Acces interzis." };
  }
  if (!userId) return { ok: false, error: "User invalid." };
  const win = [7, 30, 90].includes(days) ? days : 30;
  try {
    const data = await getUserActivity(userId, win);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare la încărcare." };
  }
}

// Per-manager dashboard sections — super admin only. The form sends
// preset=full (clears the restriction) or preset=custom plus one
// section_<key>=true|false input per section.
export async function setManagerPermissionsAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Acces interzis. Doar super admin." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "User invalid." };

  const preset = String(formData.get("preset") ?? "");
  if (preset !== "full" && preset !== "custom") return { error: "Preset invalid." };
  const sections =
    preset === "full"
      ? null
      : DASHBOARD_SECTIONS.filter((s) => formData.get(`section_${s}`) === "true");

  try {
    await setManagerSections(id, sections);
    refresh(id);
    return { ok: "Permisiuni actualizate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvarea permisiunilor." };
  }
}

export async function resetUserLimitsAction(formData: FormData) {
  const adminId = await requireSection("users");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await assertCanManageTarget(adminId, id);
  await setUserLimits(id, { max_file_size: null, max_total_size: null });
  refresh(id);
}

export async function setUserLimitsAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let adminId: string;
  try {
    adminId = await requireSection("users");
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
    await assertCanManageTarget(adminId, id);
    await setUserLimits(id, { max_file_size, max_total_size });
    refresh(id);
    return { ok: "Limite actualizate." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
}
