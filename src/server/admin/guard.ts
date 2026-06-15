import "server-only";
import { createClient } from "@/lib/supabase/server";

// Authoritative admin gate for dashboard server actions / data loads.
// UI hiding is not security — every mutation must call this first.
// Returns the admin's user id, or throws.
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("Neautentificat.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (profile?.role !== "admin") throw new Error("Acces interzis.");
  return id;
}
