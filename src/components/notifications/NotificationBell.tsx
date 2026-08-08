"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { NotificationRow } from "@/server/notifications/service";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMenuModality } from "@/lib/useMenuModality";
import { NotificationIsland } from "./NotificationIsland";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  clearNotificationsAction,
} from "@/app/notification-actions";

/* Where the panel and the island grow from, as a CSS transform-origin x.

   Both hang off the right edge of the navbar action cluster, but the bell sits
   further left inside it, behind the theme toggle and the user menu. Left to
   itself each would zoom out of its own top-right corner — out of the avatar,
   not out of the bell. Measuring the gap between the cluster's right edge and
   the centre of the bell turns that into `calc(100% - Npx)`, which lands the
   growth point on the icon at any width, in either shell.

   Read from the DOM at the moment of opening rather than from a ref: the bell
   is a Radix trigger rendered through `asChild`, and a ref handed to that slot
   has been empty here before. A marker attribute is read fresh, every time. */
function growthOrigin(): string {
  if (typeof document === "undefined") return "100%";
  const bell = document.querySelector("[data-notification-bell]");
  const cluster = document.querySelector("[data-navbar-actions]");
  if (!bell || !cluster) return "100%";
  const b = bell.getBoundingClientRect();
  const c = cluster.getBoundingClientRect();
  return `calc(100% - ${Math.round(c.right - (b.left + b.width / 2))}px)`;
}

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

// Badge and glow share the app's damped pop — felt, not watched.
const POP = { type: "spring", stiffness: 460, damping: 26, mass: 0.6 } as const;

// How many live arrivals the island will hold on to. A burst should announce
// itself, not queue up a minute of pills the user has to sit through.
const ISLAND_BACKLOG = 3;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menu = useMenuModality();

  // Live arrivals waiting for the island, oldest first.
  const [queue, setQueue] = useState<NotificationRow[]>([]);
  // Growth point shared by the panel and the island, measured when either opens.
  const [origin, setOrigin] = useState("100%");
  // Bumped on every live arrival; the ring remounts on the new key and pulses.
  const [pulse, setPulse] = useState(0);

  // The realtime subscription is set up once and must not be torn down every
  // time the panel opens, so it reads "is the panel open" through a ref.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Stable: the island's countdown effect depends on it.
  const advance = useCallback(() => setQueue((q) => q.slice(1)), []);

  // The panel hangs off the whole navbar action cluster, not off the bell: the
  // bell sits to the left of the theme toggle and the user menu, so anchoring
  // to it would leave the panel floating mid-header instead of tucked against
  // the edge of the page, where it has always been.
  //
  // A measurable rather than a ref to the node: a ref is still empty when the
  // anchor is first read, and an anchor that measures nothing puts the panel in
  // the top-left corner. This resolves the cluster at measure time, every time,
  // and falls back to the bell's own header if the marker is ever missing.
  const anchor = useRef({
    getBoundingClientRect: () => {
      const el =
        document.querySelector("[data-navbar-actions]") ??
        document.querySelector("header");
      return (el ?? document.body).getBoundingClientRect();
    },
  });

  const { data, mutate } = useSWR("notifications", () => getNotificationsAction(), {
    revalidateOnFocus: true,
    // While the panel is open, poll as a safety net so a new notification shows
    // up live even if a realtime event is missed.
    refreshInterval: open ? 5000 : 0,
  });
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  // Live updates: refresh the feed when a notification row for this user changes.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || cancelled) return;
      // Authenticate the realtime socket with the user's JWT so RLS-filtered
      // postgres_changes are actually delivered (otherwise the socket runs as
      // anon, auth.uid() is null, and the row-level policy drops every event —
      // which looked like "notifications only show up after a refresh").
      if (session.access_token) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          (payload) => {
            // Insert: prepend the new row straight into the cache so it appears
            // instantly, even with the panel open (a bare revalidate sometimes
            // didn't refresh the already-open list). Other changes revalidate.
            if (payload.eventType === "INSERT") {
              const row = payload.new as NotificationRow;
              void mutate(
                (cur) => {
                  const list = cur ?? [];
                  return list.some((n) => n.id === row.id)
                    ? list
                    : [row, ...list].slice(0, 20);
                },
                { revalidate: false },
              );
              // Announce it: the bell glows once, and the island carries the
              // notification out of the icon — unless the panel is already
              // open, where the same row is appearing in the list anyway.
              setPulse((n) => n + 1);
              if (!openRef.current) {
                setOrigin(growthOrigin());
                setQueue((q) =>
                  q.some((n) => n.id === row.id) ? q : [...q, row].slice(-ISLAND_BACKLOG),
                );
              }
            } else {
              void mutate();
            }
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [mutate]);

  function markRead(n: (typeof items)[number]) {
    if (n.read_at) return;
    void mutate(
      items.map((it) => (it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it)),
      { revalidate: false },
    );
    void markNotificationReadAction(n.id);
  }

  // The bell lives on BOTH hosts, so notification links are absolute and may
  // point at the other one. Same-origin absolute links navigate in-app (a link
  // to a page of the site you're already on shouldn't spawn a tab); anything on
  // another origin — the dashboard from the app, or vice versa — opens a tab.
  // Relative paths stay in-app.
  function navigate(href: string) {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href);
        if (url.origin === window.location.origin) {
          router.push(url.pathname + url.search);
          return;
        }
      } catch {
        // Malformed URL — fall through to opening it as-is.
      }
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  // Clicking a link inside the message goes to THAT link; clicking anywhere else
  // on the notification goes to the notification's own link.
  function rowClick(e: React.MouseEvent, n: (typeof items)[number]) {
    const anchor = (e.target as HTMLElement).closest("a");
    setOpen(false);
    markRead(n);
    if (anchor) {
      e.preventDefault();
      navigate(anchor.getAttribute("href") ?? "");
      return;
    }
    if (n.link) navigate(n.link);
  }

  // Clicking the island does what clicking the same row in the panel does: it
  // marks the notification read and goes where it points. Only a notification
  // with nowhere to go falls back to opening the panel, so the click is never
  // wasted — and the rest of the queue is dropped, since the panel lists it.
  function activateIsland() {
    const n = queue[0];
    if (!n) return;
    markRead(n);
    if (n.link) {
      navigate(n.link);
      return;
    }
    setOrigin(growthOrigin());
    setQueue([]);
    setOpen(true);
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
    <>
    {/* The panel used to be pinned to a fixed corner and closed by a listener on
        the document. Anchored to the bell instead, it stays put on any viewport,
        closes on Escape as well as on an outside click, and hands focus back. */}
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setOrigin(growthOrigin());
        setOpen(next);
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverTrigger asChild {...menu.triggerProps}>
        <Button
          data-notification-bell
          variant="unstyled"
          type="button"
          aria-label={unread > 0 ? `Notificări (${unread} necitite)` : "Notificări"}
          title="Notificări"
          className="relative rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-50 data-[state=open]:bg-zinc-800/60 data-[state=open]:text-zinc-50"
        >
          {/* The glow. Keyed by the arrival counter, so each new notification
              mounts a fresh ring that runs its one-shot pulse and then sits
              invisible until the next one replaces it. Decorative and inert:
              the arrival is already announced in words by the island. */}
          {pulse > 0 && (
            <motion.span
              key={pulse}
              aria-hidden
              // border, not ring: Tailwind's ring IS a box-shadow, and the
              // inline boxShadow animated below would overwrite it — leaving
              // the soft halo with no contour to sit on.
              className="pointer-events-none absolute inset-0 rounded-md border-2 border-indigo-400"
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.75, 1.2, 1.45],
                boxShadow: [
                  "0 0 0 0 rgba(129,140,248,0)",
                  "0 0 16px 3px rgba(129,140,248,0.55)",
                  "0 0 22px 6px rgba(129,140,248,0)",
                ],
              }}
              transition={{ duration: 1.2, times: [0, 0.22, 1], ease: "easeOut" }}
            />
          )}

          <Bell className="h-5 w-5" />

          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
                transition={POP}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold leading-none text-white"
              >
                {/* Keyed by the label so the digit itself pops when it changes
                    — but not when 10 becomes 11 and both still read "9+". */}
                <motion.span
                  key={unread > 9 ? "9+" : unread}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={POP}
                >
                  {unread > 9 ? "9+" : unread}
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        // Enough to clear the rest of the header, so the panel starts at its
        // bottom edge the way it used to.
        sideOffset={12}
        collisionPadding={12}
        // Radix's own origin would be this box's corner, which sits over the
        // avatar. Overridden inline so the panel unfolds out of the bell, the
        // same point the island erupts from.
        style={{ transformOrigin: `${origin} top` }}
        // Out in two thirds of the time it came in: a panel that lingers on the
        // way out reads as lag.
        className="flex max-h-[70vh] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border-zinc-800 bg-zinc-900 p-0 shadow-xl data-[state=closed]:duration-150 data-[state=open]:duration-200"
        {...menu.contentProps}
      >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Notificări</p>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <Button variant="unstyled"
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs text-indigo-400 transition hover:text-indigo-300"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marchează citite
                </Button>
              )}
              {items.length > 0 && (
                <Button variant="unstyled"
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-zinc-400 transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Golește
                </Button>
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
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => rowClick(e, n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        rowClick(e as unknown as React.MouseEvent, n);
                      }
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer gap-2.5 px-4 py-3 text-left outline-none focus-visible:bg-zinc-800/40"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        n.read_at ? "bg-transparent" : "bg-indigo-400"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="break-words text-sm font-medium text-zinc-100">{n.title}</span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-500">{ago(n.created_at)}</span>
                      </span>
                      {n.body && (
                        <span
                          className="mt-0.5 block text-xs text-zinc-400 [overflow-wrap:anywhere] [&_a]:text-indigo-400 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: n.body }}
                        />
                      )}
                    </span>
                    {n.read_at && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                  </div>
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => removeItem(n.id)}
                    aria-label="Șterge notificarea"
                    title="Șterge"
                    className="flex shrink-0 items-center px-3 text-zinc-500 opacity-100 transition hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
        </div>
      </PopoverContent>
    </Popover>

    <NotificationIsland
      item={queue[0] ?? null}
      pending={Math.max(0, queue.length - 1)}
      originX={origin}
      onDone={advance}
      onActivate={activateIsland}
    />
    </>
  );
}
