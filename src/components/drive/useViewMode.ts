"use client";

import { useSyncExternalStore } from "react";

export type ViewMode = "list" | "grid";

const KEY = "ngig-view-mode";
// Grid by default: most of what people keep here is visual, and a thumbnail
// grid is what makes a folder recognisable at a glance. The list stays one
// click away for folders with many files, where density beats preview.
const DEFAULT: ViewMode = "grid";

const listeners = new Set<() => void>();

function read(): ViewMode {
  try {
    return localStorage.getItem(KEY) === "list" ? "list" : DEFAULT;
  } catch {
    return DEFAULT; // private mode / storage blocked
  }
}

export function setViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // preference is best-effort; the toggle still works for this session
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Also follow the preference across tabs.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/* The list/grid preference, shared by every drive surface.

   useSyncExternalStore rather than useState + an effect: localStorage is an
   external store, and reading it during render would break SSR. The server
   snapshot is the default, so the markup matches on first paint and only
   corrects itself if the stored value differs. */
export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}
