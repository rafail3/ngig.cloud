"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/server/admin/guard";
import {
  approveInviteRequest,
  rejectInviteRequest,
  deleteInviteRequest,
} from "@/server/invites/service";
import { sendInviteCode, sendInviteRejected } from "@/server/email/resend";

export async function approveRequestAction(formData: FormData) {
  const adminId = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { code, email, name } = await approveInviteRequest(id, adminId);
  // Email the requester the code — best-effort, the approval already stands.
  try {
    await sendInviteCode({ email, code, name });
  } catch {
    // non-critical; the code is visible in the dashboard for manual resend
  }
  revalidatePath("/dashboard/invite-requests");
}

export async function rejectRequestAction(formData: FormData) {
  const adminId = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { email, name } = await rejectInviteRequest(id, adminId);
  // Notify the requester — best-effort, the rejection already stands.
  try {
    await sendInviteRejected({ email, name });
  } catch {
    // non-critical
  }
  revalidatePath("/dashboard/invite-requests");
}

export async function deleteRequestAction(formData: FormData) {
  // History deletion is reserved for the super admin.
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteInviteRequest(id);
  revalidatePath("/dashboard/invite-requests");
}
