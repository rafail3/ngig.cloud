"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { Bell } from "lucide-react";
import type { NotificationRow } from "@/server/notifications/service";

/* A Dynamic-Island-style pill that erupts out of the bell when a notification
   arrives live, holds for a few seconds, then retracts into it again.

   The motion recipe is taken from SmoothUI's Dynamic Island (MIT, built on the
   same Motion library this app already uses) rather than invented here:

   - the shell carries `layout` with an explicit numeric borderRadius, so it
     springs between sizes without the corners smearing — a radius set in CSS
     gets distorted by Motion's layout projection, one set in `style` does not;
   - the content is keyed by notification id and enters out of a blur one beat
     after the shell, so the pill finishes resizing before the text sharpens
     into it. Without the delay the two read as one blurry lurch.

   What is ours: the origin. The pill grows from a point on the bell rather than
   from its own corner, which is what makes it read as coming OUT of the icon. */

// Long enough to read a title and a line of body, short enough not to sit in
// the corner of the screen. Matches the 3-5s window toasts are held to.
const DISPLAY_MS = 4500;

// The shell resizes on a spring with a little bounce — this is the only place
// the island is allowed to feel springy; everything else is damped.
const SHELL: Transition = { type: "spring", bounce: 0.32, duration: 0.42 };
const POP: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.7 };

/* Notification bodies are stored as HTML (they carry links). The pill shows a
   single quiet line, so the markup is reduced to its text. DOMParser builds an
   inert document: nothing runs, nothing is fetched, and reading `textContent`
   cannot reintroduce the markup. */
function plainText(html: string | null): string {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

export function NotificationIsland({
  item,
  pending,
  originX,
  onDone,
  onActivate,
}: {
  /** The notification currently on screen, or null when the island is closed. */
  item: NotificationRow | null;
  /** How many more are queued behind this one. */
  pending: number;
  /** Horizontal growth point, as a CSS transform-origin x — see the bell. */
  originX: string;
  /** The pill's time is up, or it was dismissed: advance the queue. */
  onDone: () => void;
  /** The pill was clicked: follow the notification. */
  onActivate: () => void;
}) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);

  // The countdown restarts whenever the pill shows a different notification,
  // and holds while the pointer is on it — reading is not a race.
  useEffect(() => {
    if (!item || paused) return;
    const timer = window.setTimeout(onDone, DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [item, paused, onDone]);

  const click = useCallback(() => {
    onActivate();
    onDone();
  }, [onActivate, onDone]);

  const preview = plainText(item?.body ?? null);

  return (
    // aria-live rather than a role that steals focus: a notification arriving is
    // news, not an interruption. The region stays mounted so the announcement
    // fires on the content, not on the container appearing.
    <div
      aria-live="polite"
      // Pinned to the same right edge as the panel (the header's own padding),
      // so both hang off the navbar cluster and neither can drift.
      className="pointer-events-none fixed right-3 top-[4.75rem] z-50 sm:right-5"
    >
      <AnimatePresence>
        {item && (
          <motion.div
            key="island"
            // The growth point sits on the bell, not on this box's corner.
            style={{ transformOrigin: `${originX} top` }}
            initial={{ opacity: 0, scale: 0.5, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            // Out faster than in, so dismissing never feels like waiting.
            exit={{ opacity: 0, scale: 0.55, y: -6, transition: { duration: 0.17, ease: "easeIn" } }}
            transition={SHELL}
          >
            <motion.div
              layout
              // Numeric, in `style`: a Tailwind rounded-* class would be
              // stretched by the layout projection while the width springs.
              style={{ borderRadius: 26 }}
              transition={SHELL}
              className="pointer-events-auto overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30"
            >
              <button
                type="button"
                onClick={click}
                onPointerEnter={() => setPaused(true)}
                onPointerLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                className="flex max-w-[min(21rem,calc(100vw-1.5rem))] items-center gap-3 py-2.5 pl-3.5 pr-4 text-left"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
                  <Bell className="size-4" />
                </span>

                {/* Keyed by id: a second notification replacing the first
                    remounts this, so the new text blurs in while the shell
                    springs to its width. */}
                <motion.span
                  key={item.id}
                  className="min-w-0 flex-1"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(5px)", scale: 0.96 }}
                  animate={
                    reduce
                      ? { opacity: 1, transition: { duration: 0.15 } }
                      : {
                          opacity: 1,
                          filter: "blur(0px)",
                          scale: 1,
                          transition: { ...POP, delay: 0.05 },
                        }
                  }
                >
                  <span className="block truncate text-sm font-medium text-zinc-100">
                    {item.title}
                  </span>
                  {preview && (
                    <span className="mt-0.5 block truncate text-xs text-zinc-400">{preview}</span>
                  )}
                </motion.span>

                {pending > 0 && (
                  <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                    +{pending}
                  </span>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
