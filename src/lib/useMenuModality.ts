"use client";

import { useRef } from "react";

/**
 * Keeps a menu's closing focus honest about how it was opened.
 *
 * Radix returns focus to the trigger when a menu closes, which is exactly right
 * for someone navigating by keyboard — losing their place would be worse than
 * any ring. But the browser then paints a focus ring on a trigger the mouse user
 * has already moved on from, and that ring is what reads as a glitch.
 *
 * `:focus-visible` is supposed to tell those two apart and does not here: the
 * focus is programmatic, and the heuristic keeps it visible. So the distinction
 * is made explicitly — remember which device opened the menu, and skip the focus
 * hand-back only for the pointer.
 *
 * Spread `triggerProps` on the trigger and `contentProps` on the content.
 */
export function useMenuModality() {
  const openedByPointer = useRef(false);

  return {
    triggerProps: {
      onPointerDown: () => {
        openedByPointer.current = true;
      },
      // Enter/Space/ArrowDown on the trigger — a keyboard user, who needs the
      // focus back and should see where it went.
      onKeyDown: () => {
        openedByPointer.current = false;
      },
    },
    contentProps: {
      onCloseAutoFocus: (e: Event) => {
        if (openedByPointer.current) e.preventDefault();
      },
    },
  };
}
