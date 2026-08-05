"use client";

import { useRef, useState } from "react";

/* Detects a touch long-press (hold without moving) and fires `onLongPress`. Used
   on mobile to enter selection mode — there's no drag-and-drop on touch. Spread
   `handlers` on the row, and call `consumedClick()` at the top of the row's
   onClick to skip the click that a touch synthesizes right after the press.

   `pressing` is true for as long as the finger is down and the press is still a
   candidate. Render it: without any feedback the row sits inert for the whole
   delay, which is the single biggest reason long-press feels broken — the user
   can't tell the press registered until it has already fired. */
export function useLongPress(
  onLongPress: () => void,
  { delay = 400, moveTolerance = 14 }: { delay?: number; moveTolerance?: number } = {},
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const [pressing, setPressing] = useState(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPressing(false);
  };

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      // A second finger means a pinch/zoom, not a press — bail out rather than
      // firing a selection under a gesture the user meant for the viewport.
      if (e.touches.length > 1) {
        cancel();
        return;
      }
      fired.current = false;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      if (timer.current) clearTimeout(timer.current);
      setPressing(true);
      timer.current = setTimeout(() => {
        fired.current = true;
        setPressing(false);
        // Where supported (Android/Chrome), a short tick confirms the selection
        // the way a native long-press does. iOS Safari ignores it silently.
        navigator.vibrate?.(15);
        onLongPress();
      }, delay);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length > 1) {
        cancel();
        return;
      }
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
    // True while the finger is down and the press could still become a
    // long-press — drive a pressed style off this.
    pressing,
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
