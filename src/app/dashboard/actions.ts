"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sign out of the dashboard session and return to the dashboard login.
// On the dashboard host the proxy rewrites "/login" → "/dashboard/login".
export async function dashboardSignOut() {
  const supabase = await createClient();
  // Local scope: end only the dashboard session, so it doesn't also revoke the
  // user's cloud session (same account, other app). Default scope is global.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
