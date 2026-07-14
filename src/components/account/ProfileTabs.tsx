"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { UserRound, ShieldCheck, Sparkles } from "lucide-react";

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
    <div>
      <div
        role="tablist"
        aria-label="Secțiuni profil"
        className="flex gap-6 overflow-x-auto border-b border-zinc-900 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => {
          const on = t.id === active;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              onClick={() => select(t.id)}
              className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 pt-1 text-sm outline-none transition-colors focus-visible:text-zinc-50 ${
                on ? "font-medium text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
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
            </button>
          );
        })}
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="pt-6"
        >
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
