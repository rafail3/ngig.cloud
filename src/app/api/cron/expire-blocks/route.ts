import { NextResponse } from "next/server";
import { expireBlocks } from "@/server/admin/users";

// Daily cron (see vercel.json) that clears time-limited blocks whose window has
// lapsed and notifies the admins (+ the affected user) that the block expired.
// Guarded by the same CRON_SECRET bearer token as the trash purge so the public
// can't trigger it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const expired = await expireBlocks();
  return NextResponse.json({ expired });
}
