import "server-only";
import { createClient } from "@supabase/supabase-js";

// Privileged server-only client (secret key). Bypasses RLS.
// Use ONLY in server code for trusted operations: creating users,
// reading/consuming invite codes. Never import into client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
