"use client";

import { Gauge, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMenuModality } from "@/lib/useMenuModality";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SpeedMenu({
  rate,
  onChange,
  dark = false,
}: {
  rate: number;
  onChange: (r: number) => void;
  dark?: boolean;
}) {
  const menu = useMenuModality();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild {...menu.triggerProps}>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Viteză redare"
          className={`gap-1 rounded px-1.5 py-1 text-xs font-medium hover:bg-transparent dark:hover:bg-transparent ${
            dark ? "text-zinc-100 hover:text-white" : "text-zinc-300 hover:text-zinc-50"
          }`}
        >
          <Gauge className="h-4 w-4" /> {rate}x
        </Button>
      </DropdownMenuTrigger>

      {/* Opens above the control bar it sits in, the way it always has — the
          menu measures the trigger itself now instead of us reading its rect. */}
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        // Above the preview's own layers: the player it belongs to is inside a
        // full-screen overlay, and a menu at the default depth would open behind it.
        className="z-[71] w-24 rounded-lg border-zinc-800 bg-zinc-900 p-0 shadow-2xl"
        {...menu.contentProps}
      >
        <DropdownMenuRadioGroup
          value={String(rate)}
          onValueChange={(v) => onChange(Number(v))}
        >
          {RATES.map((r) => (
            <DropdownMenuRadioItem
              key={r}
              value={String(r)}
              // The tick reads on the right here, so the primitive's reserved
              // left gutter and its indicator are dropped — the radio semantics
              // stay, only the mark is ours.
              className="justify-between rounded-none px-3 py-1.5 pl-3 text-xs text-zinc-300 focus:bg-zinc-800/60 focus:text-zinc-50 data-[state=checked]:bg-zinc-800 data-[state=checked]:text-zinc-50 [&>span:first-child]:hidden"
            >
              {r}x
              {r === rate && <Check className="h-3 w-3 text-indigo-400" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
