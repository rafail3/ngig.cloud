import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/server/files/service";

// Daily cron (see vercel.json) that permanently removes trashed files past the
// retention window. Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the
// CRON_SECRET env var is set; we reject anything else so the endpoint can't be
// triggered by the public.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const purged = await purgeExpiredTrash();
  return NextResponse.json({ purged });
}
