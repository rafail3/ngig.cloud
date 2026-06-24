"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  // Local scope: end only THIS session. The default (global) would revoke every
  // session for the user — so logging out of the cloud app would also kill the
  // dashboard session (same account, other app) and vice versa.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
