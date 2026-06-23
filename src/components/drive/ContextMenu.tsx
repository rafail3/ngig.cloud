"use client";

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { menuMotion } from "./anim";

export type MenuAction = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

// `align: "left"` opens the menu to the right of the anchor x (used for
// right-click at the cursor); `"right"` puts the menu's right edge at x (used for
// the kebab button sitting at a row's right edge).
type OpenMenu = (actions: MenuAction[], x: number, y: number, align?: "left" | "right") => void;

const Ctx = createContext<OpenMenu | null>(null);

export function useContextMenu(): OpenMenu {
  const open = useContext(Ctx);
  if (!open) throw new Error("useContextMenu must be used within ContextMenuProvider");
  return open;
}

const PAD = 8;
type State = { actions: MenuAction[]; x: number; y: number; align: "left" | "right" };

/* A single app-wide context menu. Rows call `open(...)` from their right-click
   handler (and the kebab button), so the same styled menu shows for every file
   and folder, while right-clicking anywhere else falls through to the browser's
   native menu. Closes on outside click, another right-click, scroll, or Escape. */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; origin: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = useCallback<OpenMenu>((actions, x, y, align = "left") => {
    setCoords(null);
    setState({ actions, x, y, align });
  }, []);
  const close = useCallback(() => setState(null), []);

  // Measure the menu, then clamp it inside the viewport (flipping up when there
  // isn't room below) so it never spills off-screen.
  useLayoutEffect(() => {
    if (!state || !menuRef.current) return;
    const w = menuRef.current.offsetWidth;
    const h = menuRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = state.align === "right" ? state.x - w : state.x;
    left = Math.max(PAD, Math.min(left, vw - PAD - w));

    let flippedUp = false;
    let top = state.y;
    if (top + h > vh - PAD) {
      top = state.y - h;
      flippedUp = true;
      if (top < PAD) top = Math.max(PAD, vh - PAD - h);
    }
    setCoords({ top, left, origin: `${flippedUp ? "bottom" : "top"} ${state.align}` });
  }, [state]);

  // Dismiss on any interaction outside the menu. The contextmenu listener does
  // NOT preventDefault, so a right-click on another row reopens via that row's
  // handler, and a right-click on empty space shows the native menu.
  useEffect(() => {
    if (!state) return;
    const outside = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onScroll = () => close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("contextmenu", outside, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("contextmenu", outside, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [state, close]);

  return (
    <Ctx.Provider value={open}>
      {children}
      {state &&
        createPortal(
          <div
            ref={menuRef}
            data-keep-selection
            className="fixed z-[71]"
            style={{
              top: coords ? coords.top : state.y,
              left: coords ? coords.left : state.x,
              visibility: coords ? "visible" : "hidden",
            }}
          >
            <motion.div
              {...menuMotion}
              style={{ transformOrigin: coords?.origin ?? "top left" }}
              className="w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-2xl"
            >
              {state.actions.map((a, i) => (
                <Fragment key={a.label}>
                  {a.danger && i > 0 && !state.actions[i - 1].danger && (
                    <div className="my-1 h-px bg-zinc-800" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      a.onSelect();
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition ${
                      a.danger
                        ? "text-red-400 hover:bg-red-950/40"
                        : "text-zinc-200 hover:bg-zinc-800/70"
                    }`}
                  >
                    <a.icon className="h-4 w-4 shrink-0" />
                    {a.label}
                  </button>
                </Fragment>
              ))}
            </motion.div>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
