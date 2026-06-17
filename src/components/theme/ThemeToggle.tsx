"use client";

import { useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Luminos", icon: Sun },
  { value: "dark", label: "Întunecat", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // Trigger icon: explicit choice shows its icon; "system" shows a monitor.
  const TriggerIcon =
    theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Schimbă tema"
        title="Temă"
        className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-50"
      >
        <TriggerIcon className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
            {OPTIONS.map((o) => {
              const active = theme === o.value;
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setTheme(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {o.label}
                  {active && <Check className="ml-auto h-3.5 w-3.5 text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
