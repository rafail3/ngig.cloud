"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sign out of the dashboard session and return to the dashboard login.
// On the dashboard host the proxy rewrites "/login" → "/dashboard/login".
export async function dashboardSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
