"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";

export type SelectOption = { key: string; label: string };

// Space (px) the popover needs below the trigger before it flips upward.
const FLIP_THRESHOLD = 272; // max-h-64 (256) + margins

type Pos = { left: number; width: number; top?: number; bottom?: number; up: boolean };

// Custom single-select — the native <select> can't be styled to match the rest
// of the product (and renders as an OS widget on mobile). The popover renders in
// a PORTAL with fixed positioning so it is never clipped by overflow-hidden
// ancestors (animated editors, cards) and flips upward near the viewport bottom.
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
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Portals only exist client-side; render them after mount so hydration matches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < FLIP_THRESHOLD && r.top > spaceBelow;
    setPos({
      left: r.left,
      width: r.width,
      up,
      ...(up
        ? { bottom: window.innerHeight - r.top + 6 }
        : { top: r.bottom + 6 }),
    });
  }

  function toggle() {
    if (!open) place();
    setOpen((v) => !v);
  }

  // While open: close on outside press (trigger + popover count as inside) and
  // track scroll/resize so the fixed popover stays glued to its trigger.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const current = options.find((o) => o.key === value);
  const label = current?.label ?? "Alege…";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
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

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={popRef}
                role="listbox"
                initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: pos.left,
                  width: pos.width,
                  top: pos.top,
                  bottom: pos.bottom,
                  zIndex: 100,
                }}
                className="max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/30 backdrop-blur"
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
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
