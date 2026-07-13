"use server";

import { headers } from "next/headers";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendInviteRequest, sendInviteRequestAck } from "@/server/email/resend";
import { createInviteRequest, emailHasAccount } from "@/server/invites/service";
import { notifyAdmins } from "@/server/notifications/service";
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

  // Already have an account? Then there's nothing to request — log in instead.
  // Best-effort: if the lookup itself fails, don't block a legitimate request.
  try {
    if (await emailHasAccount(email)) {
      return {
        error: "Ai deja un cont cu acest email. Autentifică-te în loc să ceri o invitație.",
        values,
      };
    }
  } catch {
    // lookup failed — fall through and let the request proceed
  }

  // Persist the request first — it's the source of truth the dashboard reads.
  // A duplicate pending request for the same email is politely rejected.
  try {
    const result = await createInviteRequest({ name, email, message: message || null, ip: ip ?? null });
    if (result === "duplicate") {
      return { error: "Ai deja o cerere de invitație în așteptare. Revenim în curând.", values };
    }
    // Notify admins in-app (best-effort; never fail the request on this).
    try {
      await notifyAdmins({
        type: "invite_request",
        title: "📩 Cerere nouă de invitație",
        body: `${name} (${email}) a cerut o invitație.`,
        link: "/invite-requests",
      });
    } catch {
      // non-critical
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvarea cererii.", values };
  }

  try {
    // The owner notification is what must succeed for the request to count.
    await sendInviteRequest({ name, email, message, ip: ip ?? null });
    // Acknowledge the requester — best-effort, never fail the request on this.
    try {
      await sendInviteRequestAck({ name, email });
    } catch {
      // ack is non-critical
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la trimitere.", values };
  }
}
