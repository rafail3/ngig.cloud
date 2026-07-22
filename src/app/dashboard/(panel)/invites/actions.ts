"use server";

import { revalidatePath } from "next/cache";
import { requireSection, requireSuperAdmin } from "@/server/admin/guard";
import {
  createInvite,
  revokeInvite,
  deleteInvite,
  type ExpiryOption,
} from "@/server/invites/service";
import { sendInviteCode } from "@/server/email/resend";
import type { GenerateState, SendCodeState } from "@/lib/invite-status";

const EXPIRY: ExpiryOption[] = ["never", "1h", "3h", "1d", "3d", "1w", "1mo"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createInviteAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  let adminId: string;
  try {
    adminId = await requireSection("invites");
  } catch {
    return { error: "Acces interzis." };
  }

  const expiry = String(formData.get("expiry") ?? "never") as ExpiryOption;
  if (!EXPIRY.includes(expiry)) return { error: "Opțiune de expirare invalidă." };

  const role = String(formData.get("role") ?? "user");
  if (role !== "user" && role !== "admin") return { error: "Rol invalid." };
  // Minting a MANAGER account is managing managers — super admin only.
  if (role === "admin") {
    try {
      await requireSuperAdmin();
    } catch {
      return { error: "Doar super admin poate genera invitații de manager." };
    }
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  if (email && !EMAIL_RE.test(email)) return { error: "Adresă de email invalidă." };

  const label = String(formData.get("label") ?? "").trim() || null;

  try {
    const invite = await createInvite({ expiry, role, email, label, createdBy: adminId });
    revalidatePath("/dashboard/invites");
    return { code: invite.code, email: invite.email ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la generarea codului." };
  }
}

const EMAIL_RE2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendInviteCodeAction(
  _prev: SendCodeState,
  formData: FormData,
): Promise<SendCodeState> {
  try {
    await requireSection("invites");
  } catch {
    return { error: "Acces interzis." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!EMAIL_RE2.test(email)) return { error: "Email invalid." };
  if (!code) return { error: "Cod lipsă." };

  try {
    await sendInviteCode({ email, code });
    return { ok: `Cod trimis pe ${email}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la trimitere." };
  }
}

export async function revokeInviteAction(formData: FormData) {
  await requireSection("invites");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await revokeInvite(id);
  revalidatePath("/dashboard/invites");
}

export async function deleteInviteAction(formData: FormData) {
  // History deletion is reserved for the super admin.
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteInvite(id);
  revalidatePath("/dashboard/invites");
}
