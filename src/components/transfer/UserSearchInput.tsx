"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, Star } from "lucide-react";
import {
  searchUsersAction,
  getFrequentRecipientsAction,
} from "@/app/(app)/transfers/actions";
import { Avatar } from "@/components/shell/Avatar";
import type { UserSearchResult } from "@/lib/transfer";
import { useClickOutside } from "@/lib/useClickOutside";

const MAX_RECIPIENTS = 10;

// Live username search with debounce, used to pick the recipient(s) of a
// transfer. The search bar stays put — selections collect as chips BELOW it,
// so picking a 2nd/3rd person never hides the box you're still typing in.
// Focusing with an empty query surfaces the sender's most-frequent recipients
// so a repeat send never needs typing at all.
export function UserSearchInput({
  selected,
  onAdd,
  onRemove,
}: {
  selected: UserSearchResult[];
  onAdd: (user: UserSearchResult) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [frequent, setFrequent] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useClickOutside(boxRef, () => setOpen(false), open);

  useEffect(() => {
    void (async () => {
      const res = await getFrequentRecipientsAction();
      if (!("revoked" in res)) setFrequent(res);
    })();
  }, []);

  useEffect(() => {
    const q = query.trim();
    // A too-short query is handled synchronously in the change handler below —
    // nothing to do here (setState directly in an effect body is disallowed).
    if (q.length < 2) return;
    // Short debounce — just enough to skip a fetch per keystroke while still
    // feeling close to instant.
    const t = setTimeout(async () => {
      const res = await searchUsersAction(q);
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setResults(res);
      setLoading(false);
    }, 100);
    return () => clearTimeout(t);
  }, [query]);

  const selectedIds = new Set(selected.map((u) => u.id));
  const visibleResults = results.filter((u) => !selectedIds.has(u.id));
  const visibleFrequent = frequent.filter((u) => !selectedIds.has(u.id));
  const atCap = selected.length >= MAX_RECIPIENTS;

  function pick(u: UserSearchResult) {
    if (atCap) return;
    onAdd(u);
    setQuery("");
    setOpen(false);
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
          disabled={atCap}
          placeholder={
            atCap
              ? `Ai atins limita de ${MAX_RECIPIENTS} destinatari`
              : "Caută după username…"
          }
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-9 pr-9 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40 disabled:opacity-60"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </div>

      {open && !atCap && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {!loading && visibleResults.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-zinc-500">Niciun utilizator găsit.</p>
          )}
          {visibleResults.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-zinc-800/70"
            >
              <Avatar username={u.username} className="h-7 w-7 text-xs" />
              <span className="truncate text-sm text-zinc-100">{u.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Always visible under the search bar (not gated by focus) — a repeat
          send should never require typing at all. Pills, not a nested card:
          same shape as the "selected" chips below, so picking one visibly
          previews what it becomes. */}
      {!atCap && query.trim().length === 0 && visibleFrequent.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 pr-0.5 text-[11px] font-medium text-zinc-500">
            <Star className="h-3 w-3" />
            Frecvenți
          </span>
          {visibleFrequent.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/40 py-1 pl-1 pr-2.5 text-xs font-medium text-zinc-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-300"
            >
              <Avatar username={u.username} className="h-5 w-5 text-[9px]" />
              {u.username}
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="flex items-center gap-1.5 rounded-full border border-indigo-400/50 bg-indigo-500/10 py-1 pl-1.5 pr-2 text-sm font-medium text-zinc-100"
            >
              <Avatar username={u.username} className="h-5 w-5 text-[9px]" />
              {u.username}
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                aria-label={`Scoate ${u.username}`}
                className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
