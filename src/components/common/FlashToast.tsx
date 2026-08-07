"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/* A one-shot confirmation carried in the URL.

   Some actions end in a server-side `redirect()` — deleting the account you are
   currently looking at, for one, where navigating from the client races the
   page's own 404. A redirect means no client code runs after the action, so the
   confirmation cannot be raised where the button was. It rides along in the
   query string instead and is raised where you land.

   The param is stripped immediately afterwards, so a reload or a shared URL does
   not replay a message about something that happened once. */
export function FlashToast({
  param,
  message,
}: {
  param: string;
  /* A plain string, not a builder. The pages that mount this are Server
     Components, and a function cannot cross that boundary — `{value}` is
     substituted with the param's contents instead, so a message can still name
     what it is confirming. */
  message: string;
}) {
  const searchParams = useSearchParams();
  // React runs effects twice in development; without this the toast is doubled
  // on the first render, before the param is cleared.
  const shown = useRef(false);

  const value = searchParams.get(param);

  useEffect(() => {
    if (!value || shown.current) return;
    shown.current = true;
    toast.success(message.replace("{value}", value));

    /* Stripped through history, not through the router.

       `router.replace` would re-fetch the route for nothing, and on the
       dashboard host it is worse than wasteful: paths there are prefix-free in
       the browser and rewritten onto /dashboard underneath, so rebuilding the
       URL from `usePathname()` risks writing the internal path into the address
       bar. Editing the current URL in place touches neither. */
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url.toString());
  }, [value, param, message]);

  return null;
}
