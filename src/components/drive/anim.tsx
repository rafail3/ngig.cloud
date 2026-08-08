"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type Transition, type Variants } from "motion/react";

export type ClickMods = { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

// How long a single click waits before selecting, so a double-click can cancel
// it first. Short enough to feel responsive, long enough that double-clicking to
// open never flashes the selection bar.
const DOUBLE_CLICK_MS = 150;

// Single vs double click on a drive row. A plain single click selects, a double
// click opens. The select is deferred briefly so a double-click cancels it and
// never flashes the selection bar. On touch, a tap just opens. Returns an
// onClick handler for the row.
export function useRowClick(opts: {
  isTouch: boolean;
  onSelect: (mods: ClickMods) => void;
  onOpen: () => void;
}): (e: MouseEvent<HTMLElement>) => void {
  const { isTouch, onSelect, onOpen } = opts;
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (isTouch || e.detail >= 2) {
        onOpen();
        return;
      }
      const mods: ClickMods = {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onSelect(mods);
      }, DOUBLE_CLICK_MS);
    },
    [isTouch, onSelect, onOpen],
  );
}

// False during SSR + the first client render, true thereafter. Use it to gate
// attributes that differ between server and client (e.g. dnd-kit's generated aria
// ids) so SSR hydration matches — the attributes get applied right after mount.
const noopSubscribe = () => () => {};
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// True on touch / coarse-pointer devices (no hover). There, a single tap opens
// and long-press selects; on desktop a single click selects and double-click
// opens. SSR-safe: returns false (desktop) until mounted.
export function useIsTouch(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(hover: none)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(hover: none)").matches,
    () => false,
  );
}

/* Shared motion vocabulary for the whole drive surface, so every panel, card and
   menu animates with the same subtle-pro feel. Durations are short and springs
   are stiff/damped — movement is felt, not watched. Reduced-motion is honored
   globally via <MotionConfig reducedMotion="user"> in AppShell.

   Modals use the AnimatePresence-at-parent pattern: the parent wraps the
   conditional `{open && <SomeModal key="x" />}` in <AnimatePresence>, and the
   modal returns <ModalShell>. That keeps the instance (and its state) mounted
   through the exit animation, so even stateful modals fade out cleanly. */

export const panelSpring: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.7 };

// Staggered list entrance (folder grid / file rows).
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025 } },
};
// Fade only — NO vertical movement. Any y-translate on folder navigation read as
// a quick "flash from below" because the whole list re-enters on every nav; a
// pure opacity fade is consistent and never appears to jump.
export const listItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
};


// Animated modal chrome: fading scrim + spring panel. Render as the root of a
// modal that the parent mounts conditionally inside <AnimatePresence>.
export function ModalShell({
  onClose,
  children,
  title,
  // `sm:max-w-lg` used to come from the Dialog primitive, where no caller
  // could override it. It belongs here instead: this default keeps the modals
  // that pass no className looking exactly as they did, and a caller that
  // passes its own replaces the whole string — so its width finally applies.
  className = "max-w-sm sm:max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl",
  scrim = "bg-black/70",
  lockScroll = true,
}: {
  onClose: () => void;
  children: ReactNode;
  /** Accessible name. Omit when the body already renders the same heading and
   *  it would be read twice; it is then attached invisibly. */
  title?: string;
  className?: string;
  scrim?: string;
  lockScroll?: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      // `lockScroll={false}` is how the nested modals ask not to fight the one
      // underneath them; non-modal is the same request in Radix's words — no
      // second scroll lock, no second focus trap competing with the first.
      modal={lockScroll}
    >
      <DialogContent
        showCloseButton={false}
        className={`w-full gap-0 p-0 ${className}`}
        overlayClassName={`${scrim} backdrop-blur-sm`}
      >
        {/* Radix requires a title: without one the dialog opens unnamed for a
            screen reader. These panels print their own heading, so this one is
            attached invisibly rather than duplicated on screen. */}
        <DialogTitle className="sr-only">{title ?? "Fereastră de dialog"}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
