"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { UserRound, ShieldCheck, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { id: "cont", label: "Cont", icon: UserRound },
  { id: "securitate", label: "Securitate", icon: ShieldCheck },
  { id: "activitate", label: "Activitate", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Profile page tabs. The active tab lives in the URL (?tab=) so every section
// is deep-linkable; panels stay mounted (hidden) so form input and the
// insights SWR state survive switching.
export function ProfileTabs({
  cont,
  securitate,
  activitate,
}: {
  cont: React.ReactNode;
  securitate: React.ReactNode;
  activitate: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const active: TabId = TABS.some((t) => t.id === param) ? (param as TabId) : "cont";

  const select = useCallback(
    (id: TabId) => {
      router.replace(id === "cont" ? "/profil" : `/profil?tab=${id}`, {
        scroll: false,
      });
    },
    [router],
  );

  const panels: Record<TabId, React.ReactNode> = { cont, securitate, activitate };

  return (
    // The roles and the id pairing were already written out here; what was
    // missing is the movement — arrow keys between tabs, and one tab stop
    // instead of three.
    <Tabs value={active} onValueChange={(v) => select(v as TabId)} className="gap-0">
      <TabsList
        variant="line"
        aria-label="Secțiuni profil"
        className="w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-zinc-900 bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => {
          const on = t.id === active;
          const Icon = t.icon;
          return (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className={`relative h-auto flex-none shrink-0 gap-2 whitespace-nowrap rounded-none border-0 px-0 pb-3 pt-1 text-sm transition-colors after:hidden ${
                on
                  ? "font-medium text-zinc-50 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              <Icon className={`h-4 w-4 ${on ? "text-indigo-400" : ""}`} />
              {t.label}
              {on && (
                <motion.span
                  layoutId="profile-tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-indigo-400"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* forceMount: the panels have to stay mounted, or switching tabs would
          throw away half-typed form input and the insights fetch. */}
      {TABS.map((t) => (
        <TabsContent
          key={t.id}
          value={t.id}
          forceMount
          className="pt-6 data-[state=inactive]:hidden"
        >
          {panels[t.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
