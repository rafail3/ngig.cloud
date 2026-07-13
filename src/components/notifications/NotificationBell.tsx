"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useClickOutside } from "@/lib/useClickOutside";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  clearNotificationsAction,
} from "@/app/notification-actions";

// Compact Romanian relative time: "acum", "acum 5 min", "acum 3 h", "acum 2 z".
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "acum";
  const m = Math.floor(s / 60);
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `acum ${d} z`;
  return new Date(iso).toLocaleDateString("ro-RO");
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const { data, mutate } = useSWR("notifications", () => getNotificationsAction(), {
    revalidateOnFocus: true,
  });
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  // Live updates: refresh the feed when a notification row for this user changes.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void (async () => {
      const { data: claims } = await supabase.auth.getClaims();
      const uid = claims?.claims?.sub as string | undefined;
      if (!uid || cancelled) return;
      channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => void mutate(),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [mutate]);

  async function openItem(n: (typeof items)[number]) {
    setOpen(false);
    if (!n.read_at) {
      // optimistic
      void mutate(
        items.map((it) => (it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it)),
        { revalidate: false },
      );
      await markNotificationReadAction(n.id);
    }
    if (n.link) {
      // External links (announcements can carry them) open in a new tab; internal
      // paths navigate in-app.
      if (/^https?:\/\//i.test(n.link)) {
        window.open(n.link, "_blank", "noopener,noreferrer");
      } else {
        router.push(n.link);
      }
    }
  }

  async function markAll() {
    void mutate(
      items.map((it) => ({ ...it, read_at: it.read_at ?? new Date().toISOString() })),
      { revalidate: false },
    );
    await markAllNotificationsReadAction();
  }

  // Delete one notification from the history (optimistic).
  async function removeItem(id: string) {
    void mutate(
      items.filter((it) => it.id !== id),
      { revalidate: false },
    );
    await deleteNotificationAction(id);
  }

  // Clear the whole history.
  async function clearAll() {
    void mutate([], { revalidate: false });
    await clearNotificationsAction();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notificări (${unread} necitite)` : "Notificări"}
        title="Notificări"
        aria-expanded={open}
        className={`relative rounded-md p-2 transition-colors ${
          open
            ? "bg-zinc-900 text-zinc-50"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
        }`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-16 z-50 flex max-h-[70vh] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Notificări</p>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs text-indigo-400 transition hover:text-indigo-300"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marchează toate
                </button>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-zinc-400 transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Golește
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-500">
                Nicio notificare încă.
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`group flex items-stretch border-b border-zinc-800/70 transition hover:bg-zinc-800/50 ${
                    n.read_at ? "" : "bg-indigo-500/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex min-w-0 flex-1 gap-2.5 px-4 py-3 text-left"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        n.read_at ? "bg-transparent" : "bg-indigo-400"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-zinc-500">{ago(n.created_at)}</span>
                      </span>
                      {n.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-400">{n.body}</span>
                      )}
                    </span>
                    {n.read_at && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(n.id)}
                    aria-label="Șterge notificarea"
                    title="Șterge"
                    className="flex shrink-0 items-center px-3 text-zinc-500 opacity-100 transition hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
