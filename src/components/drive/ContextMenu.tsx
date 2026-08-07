"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MenuAction = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

// `align: "left"` opens the menu to the right of the anchor x (used for
// right-click at the cursor); `"right"` puts the menu's right edge at x.
type OpenMenu = (
  actions: MenuAction[],
  x: number,
  y: number,
  align?: "left" | "right",
) => void;

const Ctx = createContext<OpenMenu | null>(null);

export function useContextMenu(): OpenMenu {
  const open = useContext(Ctx);
  if (!open) throw new Error("useContextMenu must be used within ContextMenuProvider");
  return open;
}

type State = { actions: MenuAction[]; x: number; y: number; align: "left" | "right" };

/* One menu for the whole drive, opened at the cursor by any row's right-click.

   The imperative API is kept — the rows ask for a menu at a point, and asking a
   provider is far less invasive than wrapping every row in a trigger — but the
   panel underneath is now a real Radix menu instead of a portal positioned by
   hand. What the hand-written one did not have: arrow keys, typeahead, Escape,
   focus returning where it came from, and a panel that flips itself when it
   would open past the edge of the screen (which used to be a manual clamp).

   Radix positions relative to a trigger, so the trigger is an empty element
   parked at the cursor: it anchors the menu without being visible or clickable. */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);

  const open = useCallback<OpenMenu>((actions, x, y, align = "left") => {
    setState({ actions, x, y, align });
  }, []);

  return (
    <Ctx.Provider value={open}>
      {children}

      <DropdownMenu
        open={state !== null}
        onOpenChange={(next) => {
          if (!next) setState(null);
        }}
      >
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed"
            style={{ left: state?.x ?? 0, top: state?.y ?? 0, width: 0, height: 0 }}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={state?.align === "right" ? "end" : "start"}
          sideOffset={2}
          className="w-52"
          // Portalled to the body, so it has to say for itself that a click in
          // here is not a click away from the selection.
          data-keep-selection
          // Opened by pointer every time (it is a right-click), so returning
          // focus to an invisible anchor would only paint a ring on nothing.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuGroup>
            {(state?.actions ?? []).map((a) => (
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
    </Ctx.Provider>
  );
}
