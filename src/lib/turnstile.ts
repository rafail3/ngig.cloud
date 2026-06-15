import "server-only";

// Server-side verification of a Cloudflare Turnstile token via siteverify.
// Fail-OPEN when no secret is configured (local dev) so the app still works,
// fail-CLOSED when configured but the token is missing/invalid (production).
const secret = process.env.TURNSTILE_SECRET_KEY;

export async function verifyTurnstile(
  token: string | undefined,
  remoteip?: string,
): Promise<boolean> {
  if (!secret) return true; // not configured → skip (dev)
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // verification unreachable → reject, fail closed
  }
}
