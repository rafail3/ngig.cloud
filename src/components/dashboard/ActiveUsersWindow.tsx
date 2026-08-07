"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_USER_WINDOWS } from "@/lib/active-users";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Rolling-window picker for the "most active users" leaderboard. The choice
// lives in the URL (?au=) so the section is deep-linkable and the server
// re-aggregates for that window.
export function ActiveUsersWindow({ selected }: { selected: number }) {
  const router = useRouter();
  return (
    // The roles were right before, but nothing behind them: every option was a
    // separate tab stop and the arrow keys did nothing. A radio group is one
    // stop, and the arrows move between the windows.
    <RadioGroup
      value={String(selected)}
      onValueChange={(v) => router.push(`?au=${v}`, { scroll: false })}
      aria-label="Perioadă activitate"
      className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
    >
      {ACTIVE_USER_WINDOWS.map((d) => (
        // The choice reads from the filled pill, so the primitive's dot is
        // dropped — this is a segmented control, not a list of radios.
        <RadioGroupItem
          key={d}
          value={String(d)}
          className="inline-flex aspect-auto size-auto rounded-md border-0 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-400 shadow-none transition hover:text-zinc-200 data-[state=checked]:bg-indigo-500 data-[state=checked]:text-white data-[state=checked]:shadow-sm data-[state=checked]:shadow-indigo-500/25 dark:bg-transparent [&>[data-slot=radio-group-indicator]]:hidden"
        >
          {d} zile
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
