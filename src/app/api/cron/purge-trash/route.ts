import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/server/files/service";
import { purgeOldNotifications } from "@/server/notifications/service";
import { purgeOldTickets } from "@/server/tickets/service";

// Daily cron (see vercel.json) that runs every retention-window cleanup:
// permanently remove trashed files past their window, delete notifications
// older than their retention, and drop closed support tickets (with their B2
// media) past theirs. They ride this one route so we stay within Vercel Hobby's
// two-cron limit. Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the
// CRON_SECRET env var is set; we reject anything else so the endpoint can't be
// triggered by the public.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const purged = await purgeExpiredTrash();
  const notifications = await purgeOldNotifications();
  const tickets = await purgeOldTickets();
  return NextResponse.json({ purged, notifications, tickets });
}
