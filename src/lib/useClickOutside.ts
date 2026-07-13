"use client";

import { useEffect, type RefObject } from "react";

// Closes a popover/menu when a pointerdown lands outside `ref`. Robust across
// stacking contexts — unlike a `fixed inset-0` backdrop, which is clipped to an
// ancestor that has backdrop-blur / filter / transform (those create a
// containing block for fixed descendants), so the backdrop no longer covers the
// viewport and outside clicks don't register. Only active while `enabled`.
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onOutside, enabled]);
}
