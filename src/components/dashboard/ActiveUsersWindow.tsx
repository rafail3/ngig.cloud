"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_USER_WINDOWS } from "@/lib/active-users";

// Rolling-window picker for the "most active users" leaderboard. The choice
// lives in the URL (?au=) so the section is deep-linkable and the server
// re-aggregates for that window.
export function ActiveUsersWindow({ selected }: { selected: number }) {
  const router = useRouter();
  return (
    <div
      role="radiogroup"
      aria-label="Perioadă activitate"
      className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
    >
      {ACTIVE_USER_WINDOWS.map((d) => {
        const on = d === selected;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => router.push(`?au=${d}`, { scroll: false })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition ${
              on
                ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/25"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {d} zile
          </button>
        );
      })}
    </div>
  );
}
