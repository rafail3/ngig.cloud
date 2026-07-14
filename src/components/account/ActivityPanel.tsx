"use client";

import useSWR from "swr";
import {
  Sparkles,
  Lock,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Minus,
  HardDrive,
  Files,
  Lightbulb,
} from "lucide-react";
import { getInsightsAction } from "@/app/insights-actions";
import type { UserProfile } from "@/server/insights/engine";
import { formatBytes } from "@/lib/format";

const TREND: Record<UserProfile["uploadTrend"], { label: string; icon: React.ReactNode }> = {
  up: { label: "în creștere", icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
  down: { label: "în scădere", icon: <TrendingDown className="h-4 w-4 text-amber-400" /> },
  flat: { label: "constant", icon: <Minus className="h-4 w-4 text-zinc-400" /> },
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
      <span className="mt-0.5 shrink-0 text-indigo-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
        <div className="text-sm text-zinc-200">{value}</div>
      </div>
    </div>
  );
}

export function ActivityPanel() {
  const { data, isLoading } = useSWR("insights", () => getInsightsAction(), {
    revalidateOnFocus: false,
  });
  const p = data ?? null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-zinc-100">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Activitatea ta</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-400">
          <Lock className="h-3 w-3" /> Vizibil doar pentru tine
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Un rezumat privat despre cum îți folosești cloud-ul, calculat local doar din datele tale.
      </p>

      {isLoading && !p ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-950/40" />
          ))}
        </div>
      ) : !p || p.filesCount === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
          Încă nu avem destule date. Încarcă și folosește câteva fișiere și revino.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-zinc-300">{p.summary}</p>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat
              icon={<Files className="h-4 w-4" />}
              label="Fișiere"
              value={<span className="tabular-nums">{p.filesCount}</span>}
            />
            <Stat
              icon={<HardDrive className="h-4 w-4" />}
              label="Spațiu folosit"
              value={formatBytes(p.storageUsed)}
            />
            <Stat
              icon={TREND[p.uploadTrend].icon}
              label="Activitate upload"
              value={TREND[p.uploadTrend].label}
            />
            {p.activePeriod && (
              <Stat icon={<Clock className="h-4 w-4" />} label="Activ mai ales" value={p.activePeriod} />
            )}
            {p.busiestDay && (
              <Stat icon={<CalendarDays className="h-4 w-4" />} label="Ziua cea mai activă" value={p.busiestDay} />
            )}
          </div>

          {p.topTypes.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">Ce folosești cel mai des</p>
              <div className="flex flex-wrap gap-1.5">
                {p.topTypes.map((t) => (
                  <span
                    key={t.category}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {t.label}
                    <span className="tabular-nums text-indigo-300">{t.pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.tips.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {p.tips.map((tip) => (
                <div
                  key={tip.key}
                  className="flex items-start gap-2.5 rounded-xl border border-indigo-900/40 bg-indigo-950/20 px-3.5 py-2.5"
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                  <p className="text-sm text-zinc-300">{tip.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
