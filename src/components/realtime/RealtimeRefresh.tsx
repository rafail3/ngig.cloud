"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Drop-in realtime for a SERVER-rendered page or layout: subscribes to
// Postgres changes on the given tables and calls router.refresh() (debounced)
// on any change, so the server component re-renders with fresh data — no
// polling, no manual reload.
//
// Realtime respects RLS: a subscriber only receives changes to rows it can read
// (admins via is_admin() policies; a user only their own rows). The listed
// tables must be in the `supabase_realtime` publication (see the *_realtime
// migrations).
//
// To make any new page live, just render <RealtimeRefresh tables={[...]} />.
export function RealtimeRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  // Stable dependency: the effect must not re-subscribe on every render just
  // because the inline array prop has a new identity.
  const key = tables.join(",");

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    if (list.length === 0) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    // Coalesce bursts (e.g. a bulk action firing many row events) into one refresh.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    void (async () => {
      // Auth the realtime socket with the user's JWT so RLS-scoped tables
      // deliver their changes (otherwise the socket runs as anon and the
      // policies drop every event).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      let ch = supabase.channel(`realtime-refresh:${key}`);
      for (const table of list) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
      }
      channel = ch.subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, key]);

  return null;
}
