import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/server/files/service";
import { purgeOldNotifications } from "@/server/notifications/service";
import { purgeOldTickets } from "@/server/tickets/service";
import { purgeExpiredShareLinks } from "@/server/share/service";
import { refreshB2Pricing } from "@/server/billing/pricing-source";
import { cleanupOrphanB2Objects, reportB2Cleanup } from "@/server/maintenance/b2-cleanup";

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
  // Reclaim rows of share links already past expiry (the list view hides them
  // instantly; this is the backstop that removes the rows).
  const shareLinks = await purgeExpiredShareLinks();
  // Refresh B2's published rates so the cost calculator stays current. Rides
  // this daily cron (Hobby's 2-cron limit); failure is non-fatal — the cost
  // math falls back to the last known / hardcoded rates.
  const pricing = await refreshB2Pricing();
  // Orphan sweep LAST — after the trash purge above, so it sees the bucket in
  // its settled state. Multi-layer guarded (see server/maintenance/b2-cleanup);
  // admins get a bell report only when it actually found something.
  const b2 = await cleanupOrphanB2Objects();
  await reportB2Cleanup(b2);
  return NextResponse.json({ purged, notifications, tickets, shareLinks, pricing, b2 });
}
