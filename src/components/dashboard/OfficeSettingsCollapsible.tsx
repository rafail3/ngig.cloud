"use client";

import { useState } from "react";
import { ChevronDown, Server } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

  let host = dsUrl ?? "";
  try {
    if (dsUrl) host = new URL(dsUrl).host;
  } catch {
    // keep the raw string if it isn't a full URL
  }

  const statusText = !configured ? "Neconfigurat" : up ? "Operațional" : "Oprit";
  const dotClass = !configured ? "bg-zinc-500" : up ? "bg-emerald-400" : "bg-red-400";

  return (
    // The header and the panel used to be wired together by hand, with an id
    // passed between them. The primitive owns that pairing, and the panel
    // animates from its own measured height instead of from "auto".
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-4">
      <CollapsibleTrigger
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
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
        <div className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
