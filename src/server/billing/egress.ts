import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EgressSource = "download" | "preview" | "folder" | "office";

// Best-effort egress accounting for the admin cost calculator. Records the byte
// size of a file served to a user, at the moment we mint the presigned URL (the
// browser streams straight from B2, so the bytes never pass through us — the
// file's own size is the truthful figure we can log without proxying anything).
//
// Mirrors logEvent's shape: `userId` is for callers with no session (the
// OnlyOffice open is the Document Server talking to us), where the write goes
// through the service-role client under the file owner's id.
//
// Always call inside `after(() => logEgress(...))` — it must never sit on the
// request's hot path.
export async function logEgress(
  bytes: number,
  source: EgressSource,
  userId?: string,
): Promise<void> {
  if (!bytes || bytes <= 0) return;
  try {
    if (userId) {
      const admin = createAdminClient();
      await admin.from("egress_events").insert({ user_id: userId, bytes, source });
      return;
    }
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const uid = data?.claims?.sub as string | undefined;
    if (!uid) return;
    await supabase.from("egress_events").insert({ user_id: uid, bytes, source });
  } catch {
    // non-critical — a lost egress row only slightly under-counts the cost.
  }
}
