"use client";

import { Check } from "lucide-react";

/* Selection checkbox for a file/folder row — desktop only. Hidden until the row
   is hovered (group-hover) unless selected / selection mode is active (`show`).
   Always hidden on touch devices (no hover): there, selection is done by
   long-pressing a row. Stops propagation so toggling never triggers open/drag. */
export function SelectCheckbox({
  selected,
  show,
  onToggle,
  label,
}: {
  selected: boolean;
  show: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      // Stop the drag sensors' activator events (mouse + touch) so tapping the
      // checkbox never starts a row drag.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      aria-label={label ?? (selected ? "Deselectează" : "Selectează")}
      aria-pressed={selected}
      className={`h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
        selected
          ? "border-indigo-400 bg-indigo-500 text-white"
          : "border-zinc-600 text-transparent hover:border-zinc-400"
      } ${show ? "grid" : "hidden group-hover:grid"} [@media(hover:none)]:hidden`}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
