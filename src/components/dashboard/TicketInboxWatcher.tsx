"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markInboxSeenAction } from "@/app/dashboard/(panel)/tickets/actions";

// Keeps the Suport nav badge and the ticket list honest.
//
// Two facts about the App Router make this necessary:
//   1. a shared layout is NOT re-rendered on client navigation, so the badge it
//      computed on first load would stay frozen — it reappeared as soon as you
//      left the list for a ticket;
//   2. visited segments sit in the client router cache (staleTimes), so going
//      back to the list replayed the old RSC payload, with rows still marked
//      "nou" even after you'd opened them.
//
// Landing on the list therefore marks the inbox seen and then refreshes, which
// re-renders BOTH the layout (badge → 0) and the page (fresh unread marks).
// Lives in the layout so it survives navigating into a ticket and back.
export function TicketInboxWatcher() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/tickets") return;
    let cancelled = false;
    void (async () => {
      await markInboxSeenAction();
      // Refresh only after the stamp lands, so the recomputed badge sees it.
      if (!cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
