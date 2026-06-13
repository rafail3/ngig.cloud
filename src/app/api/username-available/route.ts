import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// Checks whether a username is free. Used by the register form in real time.
// Registration still requires a valid invite code, so enumeration risk is low.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = (searchParams.get("u") ?? "").trim();

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ valid: false, available: false });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  return NextResponse.json({ valid: true, available: !data });
}
