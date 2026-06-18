"use client";

import {
  Fragment,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { MoreVertical } from "lucide-react";
import { menuMotion } from "./anim";

export type MenuAction = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

// Imperative handle so a row can open the same menu on right-click, at the cursor.
export type ActionMenuHandle = { openAt: (x: number, y: number) => void };

/* Kebab button + portal menu shared by files and folders. Opens from the button
   on click, or at a point via the `openAt` handle (wired to the row's
   onContextMenu). The menu is right-anchored (its right edge sits at the anchor
   x), matching the kebab sitting at the row's right edge. */
export const ActionMenu = forwardRef<ActionMenuHandle, { actions: MenuAction[]; label?: string }>(
  function ActionMenu({ actions, label = "Opțiuni" }, ref) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    function openAtButton() {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.right });
      setOpen(true);
    }

    useImperativeHandle(
      ref,
      () => ({ openAt: (x, y) => { setPos({ top: y, left: x }); setOpen(true); } }),
      [],
    );

    return (
      <>
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (open) setOpen(false);
            else openAtButton();
          }}
          aria-label={label}
          className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {open &&
          pos &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[70]"
                onClick={() => setOpen(false)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
              />
              <div
                className="fixed z-[71] -translate-x-full"
                style={{ top: pos.top, left: pos.left }}
              >
                <motion.div
                  {...menuMotion}
                  style={{ transformOrigin: "top right" }}
                  className="w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-2xl"
                >
                  {actions.map((a, i) => (
                    <Fragment key={a.label}>
                      {a.danger && i > 0 && !actions[i - 1].danger && (
                        <div className="my-1 h-px bg-zinc-800" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
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
              </div>
            </>,
            document.body,
          )}
      </>
    );
  },
);
