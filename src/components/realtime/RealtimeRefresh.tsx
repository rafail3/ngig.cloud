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

    // Coalesce bursts (e.g. a bulk action firing many row events) into one refresh.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    let ch = supabase.channel(`realtime-refresh:${key}`);
    for (const table of list) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    const channel: RealtimeChannel = ch.subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, key]);

  return null;
}
