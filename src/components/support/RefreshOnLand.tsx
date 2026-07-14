"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Re-renders the server component whenever we land on `path`.
//
// Visited segments live in the client router cache (staleTimes), so navigating
// back to a list replays the RSC payload captured before you opened anything —
// leaving already-read tickets still marked unread. Refreshing on arrival
// recomputes that state against the read marks the thread just wrote.
export function RefreshOnLand({ path }: { path: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== path) return;
    router.refresh();
  }, [pathname, path, router]);

  return null;
}
