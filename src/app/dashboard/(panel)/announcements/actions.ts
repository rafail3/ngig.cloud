"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin/guard";
import {
  createAnnouncement,
  deleteAnnouncement,
  normalizeLink,
} from "@/server/announcements/service";

export type AnnouncementState = {
  ok?: string;
  error?: string;
  values?: { title: string; body: string; link: string };
};

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
  const body = String(formData.get("body") ?? "").trim();
  const linkRaw = String(formData.get("link") ?? "");
  const values = { title, body, link: linkRaw };

  if (!title) return { error: "Adaugă un titlu.", values };
  if (!body) return { error: "Adaugă un mesaj.", values };
  if (title.length > 120) return { error: "Titlul e prea lung (max 120 caractere).", values };
  if (body.length > 2000) return { error: "Mesajul e prea lung (max 2000 caractere).", values };

  let link: string | null;
  try {
    link = normalizeLink(linkRaw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Link invalid.", values };
  }

  try {
    const count = await createAnnouncement({ title, body, link }, adminId);
    revalidatePath("/dashboard/announcements");
    return {
      ok: `Anunț trimis către ${count} ${count === 1 ? "utilizator" : "utilizatori"}.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la trimitere.", values };
  }
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteAnnouncement(id);
  revalidatePath("/dashboard/announcements");
}
