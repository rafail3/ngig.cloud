"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";
import { useClickOutside } from "@/lib/useClickOutside";

export type SelectOption = { key: string; label: string };

// Custom single-select — the native <select> can't be styled to match the rest
// of the product (and renders as an OS widget on mobile). Same popover grammar
// as the drive's filter dropdowns.
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const current = options.find((o) => o.key === value);
  const label = current?.label ?? "Alege…";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
          open
            ? "border-indigo-500/60 bg-zinc-950 text-zinc-50 ring-2 ring-indigo-500/15"
            : "border-zinc-800 bg-zinc-950/50 text-zinc-200 hover:border-zinc-700"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />}
          <span className="truncate">{renderLabel ? renderLabel(label) : label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/30 backdrop-blur"
          >
            {options.map((o) => {
              const on = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    on ? "bg-indigo-500/15 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800/70"
                  }`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {on && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
