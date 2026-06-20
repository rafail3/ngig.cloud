"use client";

import { useRef } from "react";
import { MoreVertical } from "lucide-react";
import { useContextMenu, type MenuAction } from "./ContextMenu";

export type { MenuAction };

// The kebab (⋮) button. Opens the shared context menu right-aligned under the
// button. Right-click on the row opens the same menu at the cursor (handled by
// the row via useContextMenu directly).
export function ActionMenu({ actions, label = "Opțiuni" }: { actions: MenuAction[]; label?: string }) {
  const open = useContextMenu();
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const r = btnRef.current!.getBoundingClientRect();
        open(actions, r.right, r.bottom + 4, "right");
      }}
      aria-label={label}
      className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
    >
      <MoreVertical className="h-4 w-4" />
    </button>
  );
}
