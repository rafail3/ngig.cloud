"use client";

import { MoreVertical } from "lucide-react";
import { type MenuAction } from "./ContextMenu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMenuModality } from "@/lib/useMenuModality";

export type { MenuAction };

/* The kebab (⋮) button on every row.

   It used to ask a single app-wide panel to appear at coordinates it measured
   itself — which meant no keyboard navigation, no focus return, and a position
   that had to be re-derived by hand near the edges of the screen. It owns its
   menu now: Radix positions it, flips it when it would overflow, and gives it
   arrow keys, typeahead and Escape for free.

   The `actions` API is unchanged, so every list that renders one is untouched. */
export function ActionMenu({
  actions,
  label = "Opțiuni",
}: {
  actions: MenuAction[];
  label?: string;
}) {
  const menu = useMenuModality();

  return (
    <DropdownMenu>
      {/* The row underneath opens a preview when clicked, so the events that
          work this button must not reach it. */}
      <span
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuTrigger asChild {...menu.triggerProps}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 data-[state=open]:bg-zinc-800 data-[state=open]:text-zinc-100"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </span>

      {/* Portalled out of the row, so it has to say for itself that a click in
          here is not a click away from the selection. */}
      <DropdownMenuContent align="end" className="w-52" data-keep-selection {...menu.contentProps}>
        <DropdownMenuGroup>
          {actions.map((a) => (
            <DropdownMenuItem
              key={a.label}
              variant={a.danger ? "destructive" : "default"}
              onSelect={a.onSelect}
            >
              <a.icon className="size-4" />
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
