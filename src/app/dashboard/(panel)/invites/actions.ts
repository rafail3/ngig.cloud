"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import {
  createInvite,
  revokeInvite,
  deleteInvite,
  type ExpiryOption,
} from "@/server/invites/service";
import type { GenerateState } from "@/lib/invite-status";

const EXPIRY: ExpiryOption[] = ["never", "1h", "1d", "3d", "1w", "1mo"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createInviteAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const expiry = String(formData.get("expiry") ?? "never") as ExpiryOption;
  if (!EXPIRY.includes(expiry)) return { error: "Opțiune de expirare invalidă." };

  const role = String(formData.get("role") ?? "user");
  if (role !== "user" && role !== "admin") return { error: "Rol invalid." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  if (email && !EMAIL_RE.test(email)) return { error: "Adresă de email invalidă." };

  const label = String(formData.get("label") ?? "").trim() || null;

  try {
    const invite = await createInvite({ expiry, role, email, label, createdBy: adminId });
    revalidatePath("/dashboard/invites");
    return { code: invite.code };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la generarea codului." };
  }
}

export async function revokeInviteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await revokeInvite(id);
  revalidatePath("/dashboard/invites");
}

export async function deleteInviteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteInvite(id);
  revalidatePath("/dashboard/invites");
}
