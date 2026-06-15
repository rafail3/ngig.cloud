import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Records a login event (IP + approximate location from Vercel geo headers) and
// bumps last_seen_at. Best-effort: never block the login on a logging failure.
export async function recordLogin(userId: string, h: Headers): Promise<void> {
  try {
    const admin = createAdminClient();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    const city = decode(h.get("x-vercel-ip-city"));
    const country = h.get("x-vercel-ip-country");
    const region = h.get("x-vercel-ip-country-region");
    const userAgent = h.get("user-agent");

    await admin.from("login_audit").insert({
      user_id: userId,
      ip,
      city,
      country,
      region,
      user_agent: userAgent,
    });
    await admin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // logging is non-critical — swallow
  }
}

// Heartbeat for "online" status. Throttled: writes at most once a minute.
// `lastSeen` is the value already loaded by the caller (avoids a re-read).
export async function touchLastSeen(
  userId: string,
  lastSeen: string | null,
): Promise<void> {
  const stale = !lastSeen || Date.now() - new Date(lastSeen).getTime() > 60_000;
  if (!stale) return;
  try {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // non-critical
  }
}

// Vercel geo headers are URL-encoded (e.g. "San%20Francisco").
function decode(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
