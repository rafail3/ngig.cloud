"use client";

import { type ReactNode } from "react";
import { SlidersHorizontal, Server, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabId = "general" | "servers" | "notifications";

const TABS: { id: TabId; label: string; icon: typeof Server }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "servers", label: "Servere", icon: Server },
  { id: "notifications", label: "Notificări", icon: Bell },
];

// The tab contents are server-rendered and handed in as slots; the tab bar just
// decides which one is on screen. Inactive tabs are unmounted (not hidden) so
// the live status panel only polls while its tab is the one being looked at —
// which is what the primitive does by default.
export function SettingsTabs({
  general,
  servers,
  notifications,
}: {
  general: ReactNode;
  servers: ReactNode;
  notifications: ReactNode;
}) {
  const panels: Record<TabId, ReactNode> = { general, servers, notifications };

  return (
    // The roles were written by hand before, but not the rest of what a tab list
    // owes: arrow keys never moved between tabs, all three sat in the tab order
    // instead of one, and no panel said which tab named it.
    <Tabs defaultValue="general" className="gap-6">
      <TabsList
        aria-label="Secțiuni setări"
        className="w-full gap-1 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-1 group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-auto flex-1 gap-2 rounded-lg px-2 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/25 dark:text-zinc-400 dark:hover:text-zinc-100 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-indigo-500 dark:data-[state=active]:text-white sm:flex-none sm:px-3.5"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {TABS.map((t) => (
        <TabsContent key={t.id} value={t.id}>
          {panels[t.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
