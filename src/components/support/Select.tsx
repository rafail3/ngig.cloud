"use client";

import { type LucideIcon } from "lucide-react";
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export type SelectOption = { key: string; label: string };

// Single-select in the product's own clothes. The native <select> can't be
// styled to match and renders as an OS widget on mobile, so the behaviour comes
// from the select primitive: the list is portalled (never clipped by an
// overflow-hidden card), flips near the viewport edge, follows its trigger on
// scroll, and answers to the keyboard including type-ahead.
export function Select({
  value,
  options,
  onChange,
  icon: Icon,
  disabled,
  ariaLabel,
  className = "",
  renderLabel,
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (key: string) => void;
  icon?: LucideIcon;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  // Lets a caller prefix the trigger text (e.g. "Prioritate: Medie").
  renderLabel?: (label: string) => string;
}) {
  const label = options.find((o) => o.key === value)?.label ?? "Alege…";

  return (
    <SelectRoot value={value} onValueChange={onChange} disabled={disabled}>
      {/* The label is written out rather than left to SelectValue: callers may
          prefix it, and the primitive would only echo the chosen item. */}
      <SelectTrigger
        aria-label={ariaLabel}
        className={`h-auto w-full justify-between gap-2 rounded-lg border-zinc-800 bg-zinc-950/50 px-3 py-2 text-left text-zinc-200 shadow-none hover:border-zinc-700 disabled:opacity-60 data-[state=open]:border-indigo-500/60 data-[state=open]:bg-zinc-950 data-[state=open]:text-zinc-50 data-[state=open]:ring-2 data-[state=open]:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-950/50 [&>svg:last-child]:text-zinc-500 [&>svg:last-child]:opacity-100 [&>svg:last-child]:transition-transform data-[state=open]:[&>svg:last-child]:rotate-180 ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />}
          <span className="truncate">{renderLabel ? renderLabel(label) : label}</span>
        </span>
      </SelectTrigger>

      <SelectContent
        position="popper"
        align="start"
        sideOffset={6}
        className="max-h-64 w-[var(--radix-select-trigger-width)] rounded-xl border-zinc-800 bg-zinc-950/95 p-0.5 shadow-xl shadow-black/30 backdrop-blur"
      >
        {options.map((o) => (
          <SelectItem
            key={o.key}
            value={o.key}
            className="rounded-lg px-2.5 py-2 pr-8 text-zinc-300 focus:bg-zinc-800/70 focus:text-zinc-100 data-[state=checked]:bg-indigo-500/15 data-[state=checked]:text-zinc-100 [&_svg]:text-indigo-400"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
