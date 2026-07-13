import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/server/files/service";
import { purgeOldNotifications } from "@/server/notifications/service";

// Daily cron (see vercel.json) that runs the retention-window cleanups:
// permanently remove trashed files past their window, and delete notifications
// older than their retention. Vercel sends `Authorization: Bearer
// ${CRON_SECRET}` when the CRON_SECRET env var is set; we reject anything else
// so the endpoint can't be triggered by the public.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const purged = await purgeExpiredTrash();
  const notifications = await purgeOldNotifications();
  return NextResponse.json({ purged, notifications });
}
