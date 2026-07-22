"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/server/admin/guard";
import {
  createAnnouncement,
  scheduleAnnouncement,
  deleteAnnouncement,
  resendAnnouncement,
  normalizeLink,
} from "@/server/announcements/service";
import { sanitizeMessage, messageText } from "@/server/announcements/sanitize";

export type AnnouncementState = {
  ok?: string;
  error?: string;
  // Bumped on each successful send so the composer can reset its rich editor.
  nonce?: number;
  values?: { title: string; body: string; link: string };
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Bucharest",
  });
}

export async function sendAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { error: "Acces interzis." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const bodyRaw = String(formData.get("body") ?? "");
  const linkRaw = String(formData.get("link") ?? "");
  const values = { title, body: bodyRaw, link: linkRaw };

  // Sanitize the rich-text body server-side (whitelist), then validate on its
  // plain-text projection so markup doesn't count toward the checks.
  const body = sanitizeMessage(bodyRaw);
  const text = messageText(body);

  if (!title) return { error: "Adaugă un titlu.", values };
  if (!text) return { error: "Adaugă un mesaj.", values };
  if (title.length > 120) return { error: "Titlul e prea lung (max 120 caractere).", values };
  if (text.length > 2000) return { error: "Mesajul e prea lung (max 2000 caractere).", values };

  let link: string | null;
  try {
    link = normalizeLink(linkRaw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Link invalid.", values };
  }

  // Optional scheduling: the client sends an ISO instant (converted from its
  // local datetime picker). Absent/empty = send now.
  const scheduledIso = String(formData.get("scheduledAt") ?? "").trim();
  if (scheduledIso) {
    const when = new Date(scheduledIso);
    if (Number.isNaN(when.getTime())) {
      return { error: "Data programată e invalidă.", values };
    }
    if (when.getTime() <= Date.now()) {
      return { error: "Alege un moment din viitor pentru programare.", values };
    }
    try {
      await scheduleAnnouncement({ title, body, link }, adminId, when.toISOString());
      revalidatePath("/dashboard/announcements");
      return { ok: `Anunț programat pentru ${formatWhen(when.toISOString())}.`, nonce: Date.now() };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Eroare la programare.", values };
    }
  }

  try {
    const count = await createAnnouncement({ title, body, link }, adminId);
    revalidatePath("/dashboard/announcements");
    return {
      ok: `Anunț trimis către ${count} ${count === 1 ? "utilizator" : "utilizatori"}.`,
      nonce: Date.now(),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la trimitere.", values };
  }
}

export async function deleteAnnouncementAction(formData: FormData) {
  // History deletion (which also recalls the broadcast) — super admin only.
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteAnnouncement(id);
  revalidatePath("/dashboard/announcements");
}

export async function resendAnnouncementAction(formData: FormData) {
  const adminId = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await resendAnnouncement(id, adminId);
  revalidatePath("/dashboard/announcements");
}
