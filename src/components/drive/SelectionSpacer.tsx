"use client";

import { useEffect } from "react";
import { useSelection } from "./SelectionProvider";

// The selection bar is fixed, so it floats over the list rather than pushing it
// down — that is deliberate (selecting must never move the thing you clicked).
// The cost is that it covers the last row, which is exactly the row you are
// most likely to have just selected.
//
// So the page grows by the bar's footprint while a selection is live. Not
// permanently: an always-on gap would be dead space in the common case, where
// nothing is selected.

// Bar height plus its bottom-6 offset, with room to breathe.
const CLEARANCE_PX = 96;

export function SelectionSpacer() {
  const { count } = useSelection();
  const active = count > 0;

  useEffect(() => {
    if (!active) return;
    // Growing the page is not enough on its own: the browser keeps the scroll
    // offset, so a row already sitting under the bar stays there — the new space
    // just appears below it, out of sight. When the view is at the bottom, scroll
    // by the same amount, which lifts that row clear of the bar.
    //
    // This runs after the DOM is committed, so the spacer is already counted in
    // scrollHeight: being "at the bottom" now reads as exactly CLEARANCE_PX left.
    const root = document.documentElement;
    const remaining = root.scrollHeight - (window.scrollY + window.innerHeight);
    if (window.scrollY > 0 && remaining <= CLEARANCE_PX + 4) {
      window.scrollBy({
        top: CLEARANCE_PX,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [active]);

  return <div aria-hidden className={active ? "h-24" : "h-0"} />;
}
