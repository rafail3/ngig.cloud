"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDriveSearch } from "@/components/drive/DriveSearchProvider";

/* Search lives in the header rather than on the files page, so it is reachable
   from anywhere in the app. The term is held by the shell (DriveSearchProvider)
   and read by the drive's FilterProvider; typing from another page therefore
   just needs to navigate — the query is already where the results will look for
   it. On mobile the field collapses to an icon so the header keeps its logo,
   bell and avatar. */
export function HeaderSearch() {
  const { query, setQuery } = useDriveSearch();
  const router = useRouter();
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(value: string) {
    setQuery(value);
    // The results live on the files board; typing anywhere else takes you there
    // rather than silently filtering a page the user can't see.
    if (value && pathname !== "/") router.push("/");
  }

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  const field = (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clear();
            setOpenMobile(false);
          }
        }}
        placeholder="Caută în drive…"
        aria-label="Caută fișiere și foldere"
        // appearance-none kills Safari's own search decorations, which would sit
        // on top of the clear button below.
        className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-10 pr-9 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 hover:border-zinc-700 focus:border-indigo-400/60 focus:bg-zinc-900 focus:ring-1 focus:ring-indigo-400/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <Button
          variant="unstyled"
          type="button"
          onClick={clear}
          aria-label="Șterge căutarea"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: always present, capped so it reads as a tool in the header
          rather than taking the whole bar. */}
      <div className="hidden min-w-0 max-w-md flex-1 md:block">{field}</div>

      {/* Mobile: an icon that expands over the header row. */}
      <div className="md:hidden">
        {openMobile ? (
          <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-2 rounded-lg bg-zinc-950 p-1 shadow-lg shadow-black/40">
            {field}
            <Button
              variant="unstyled"
              type="button"
              onClick={() => {
                clear();
                setOpenMobile(false);
              }}
              aria-label="Închide căutarea"
              className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="unstyled"
            type="button"
            onClick={() => {
              setOpenMobile(true);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            aria-label="Caută"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            <Search className="h-5 w-5" />
          </Button>
        )}
      </div>
    </>
  );
}
