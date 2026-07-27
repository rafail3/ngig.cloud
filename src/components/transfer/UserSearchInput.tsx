"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { searchUsersAction } from "@/app/(app)/transfers/actions";
import { Avatar } from "@/components/shell/Avatar";
import type { UserSearchResult } from "@/lib/transfer";
import { useClickOutside } from "@/lib/useClickOutside";

// Live username search with debounce, used to pick the recipient of a
// transfer. Selecting a result locks it in (shown as a chip); clearing it
// re-opens the search.
export function UserSearchInput({
  selected,
  onSelect,
  onClear,
}: {
  selected: UserSearchResult | null;
  onSelect: (user: UserSearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useClickOutside(boxRef, () => setOpen(false), open);

  useEffect(() => {
    const q = query.trim();
    // A too-short query is handled synchronously in the change handler below —
    // nothing to do here (setState directly in an effect body is disallowed).
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const res = await searchUsersAction(q);
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setResults(res);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-indigo-400/50 bg-indigo-500/10 px-3.5 py-2.5">
        <Avatar username={selected.username} className="h-7 w-7 text-xs" />
        <span className="flex-1 truncate text-sm font-medium text-zinc-100">
          {selected.username}
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Schimbă destinatarul"
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            // Loading/clearing state changes synchronously here (in the event
            // handler, not the effect below — synchronous setState in an effect
            // is disallowed). The effect only runs the debounced fetch itself.
            if (v.trim().length < 2) {
              setResults([]);
              setLoading(false);
            } else {
              setLoading(true);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder="Caută după username…"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-9 pr-9 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {!loading && results.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-zinc-500">Niciun utilizator găsit.</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-zinc-800/70"
            >
              <Avatar username={u.username} className="h-7 w-7 text-xs" />
              <span className="truncate text-sm text-zinc-100">{u.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
