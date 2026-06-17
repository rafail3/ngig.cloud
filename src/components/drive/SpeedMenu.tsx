"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Gauge, Check } from "lucide-react";

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
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top - 8, left: r.right });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label="Viteză redare"
        className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition ${
          dark ? "text-zinc-100 hover:text-white" : "text-zinc-300 hover:text-zinc-50"
        }`}
      >
        <Gauge className="h-4 w-4" /> {rate}x
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[71] w-24 -translate-x-full -translate-y-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
            >
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    onChange(r);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition ${
                    r === rate
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  {r}x {r === rate && <Check className="h-3 w-3 text-indigo-400" />}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
