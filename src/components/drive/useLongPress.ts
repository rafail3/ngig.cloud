"use client";

import { useRef } from "react";

/* Detects a touch long-press (hold without moving) and fires `onLongPress`. Used
   on mobile to enter selection mode — there's no drag-and-drop on touch. Spread
   `handlers` on the row, and call `consumedClick()` at the top of the row's
   onClick to skip the click that a touch synthesizes right after the press. */
export function useLongPress(
  onLongPress: () => void,
  { delay = 400, moveTolerance = 10 }: { delay?: number; moveTolerance?: number } = {},
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      fired.current = false;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      cancel();
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, delay);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (
        Math.abs(t.clientX - start.current.x) > moveTolerance ||
        Math.abs(t.clientY - start.current.y) > moveTolerance
      ) {
        cancel(); // moved = scroll, not a long-press
      }
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };

  return {
    handlers,
    // True once if the last touch was a long-press, so the trailing click is ignored.
    consumedClick: () => {
      if (fired.current) {
        fired.current = false;
        return true;
      }
      return false;
    },
  };
}
