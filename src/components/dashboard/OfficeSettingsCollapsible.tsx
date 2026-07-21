"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Server } from "lucide-react";

// Compact disclosure for the OnlyOffice server settings. Collapsed by default so
// the Servere tab stays clean; the header carries a live status dot + the DS host
// so health is visible without opening. The live status graph sits below this.
export function OfficeSettingsCollapsible({
  up,
  dsUrl,
  configured,
  children,
}: {
  up: boolean;
  dsUrl: string | null;
  configured: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const panelId = useId();

  let host = dsUrl ?? "";
  try {
    if (dsUrl) host = new URL(dsUrl).host;
  } catch {
    // keep the raw string if it isn't a full URL
  }

  const statusText = !configured ? "Neconfigurat" : up ? "Operațional" : "Oprit";
  const dotClass = !configured ? "bg-zinc-500" : up ? "bg-emerald-400" : "bg-red-400";

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`group flex items-center gap-3 rounded-2xl border bg-zinc-900/40 px-4 py-3.5 text-left transition-colors sm:px-6 ${
          open ? "border-indigo-500/40" : "border-zinc-800/70 hover:border-zinc-700"
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
          <Server className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-100">Configurare server</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="flex shrink-0 items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
              {statusText}
            </span>
            {host && <span className="truncate text-zinc-600">· {host}</span>}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180 text-indigo-400" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
