"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal, Server, Bell } from "lucide-react";

type TabId = "servers" | "general" | "notifications";

const TABS: { id: TabId; label: string; icon: typeof Server }[] = [
  { id: "servers", label: "Servere", icon: Server },
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "notifications", label: "Notificări", icon: Bell },
];

// The tab contents are server-rendered and handed in as slots; the tab bar just
// decides which one is on screen. Inactive tabs are unmounted (not hidden) so
// the live status panel only polls while its tab is the one being looked at.
export function SettingsTabs({
  general,
  servers,
  notifications,
}: {
  general: ReactNode;
  servers: ReactNode;
  notifications: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("servers");
  const panels: Record<TabId, ReactNode> = { servers, general, notifications };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secțiuni setări"
        className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-1"
      >
        {TABS.map((t) => {
          const on = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                on
                  ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/25"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{panels[active]}</div>
    </div>
  );
}
