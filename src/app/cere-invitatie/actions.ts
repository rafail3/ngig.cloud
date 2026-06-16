"use server";

import { headers } from "next/headers";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendInviteRequest } from "@/server/email/resend";
import type { InviteRequestState } from "@/lib/email-state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestInviteAction(
  _prev: InviteRequestState,
  formData: FormData,
): Promise<InviteRequestState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const message = String(formData.get("message") ?? "").trim();
  const values = { name, email, message };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!(await verifyTurnstile(token, ip))) {
    return { error: "Verificare anti-bot eșuată. Reîncearcă.", values };
  }

  if (!name || !email) return { error: "Completează nume și email.", values };
  if (!EMAIL_RE.test(email)) return { error: "Adresă de email invalidă.", values };
  if (message.length > 1000) return { error: "Mesajul e prea lung (max 1000 caractere).", values };

  try {
    await sendInviteRequest({ name, email, message, ip: ip ?? null });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la trimitere.", values };
  }
}
