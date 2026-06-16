"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import type { ResetRequestState } from "@/lib/email-state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const h = await headers();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const token = String(formData.get("cf-turnstile-response") ?? "");

  if (!(await verifyTurnstile(token, ip))) {
    return { error: "Verificare anti-bot eșuată. Reîncearcă.", email };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresă de email invalidă.", email };
  }

  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  // No query string — must match a Redirect URL entry exactly, else Supabase
  // falls back to Site URL (wrong domain → PKCE code_verifier cookie missing).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  // Always report success — never reveal whether an account exists.
  return { ok: true, email };
}
