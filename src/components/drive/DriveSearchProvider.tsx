"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DriveSearchCtx = { query: string; setQuery: (v: string) => void };

const Ctx = createContext<DriveSearchCtx | null>(null);

/* The drive's search term, owned by the app shell rather than by the drive page.
   The search box now lives in the header — above the page in the tree and
   persistent across navigation — while the filtering happens inside
   <FilterProvider> on the files page. One state above both is what lets the two
   agree without mirroring the query through the URL and fighting keystrokes. */
export function DriveSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The shared search state, or null outside the shell (tests, isolated stories). */
export function useDriveSearchOptional(): DriveSearchCtx | null {
  return useContext(Ctx);
}

export function useDriveSearch(): DriveSearchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDriveSearch must be used within <DriveSearchProvider>");
  return ctx;
}
