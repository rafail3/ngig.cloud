"use client";

import useSWR from "swr";
import {
  Sparkles,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Minus,
  HardDrive,
  Files,
  Folder,
  Download,
  Eye,
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
        <div className="truncate text-sm text-zinc-200">{value}</div>
      </div>
    </div>
  );
}

// Vertical bars for the 24-hour activity histogram.
function HourChart({ hours, peak }: { hours: number[]; peak: number | null }) {
  const max = Math.max(1, ...hours);
  return (
    <div>
      <div className="flex h-20 items-end gap-[3px]">
        {hours.map((n, h) => (
          <div
            key={h}
            title={`${String(h).padStart(2, "0")}:00 — ${n}`}
            className={`flex-1 rounded-sm ${h === peak ? "bg-indigo-400" : "bg-indigo-500/30"}`}
            style={{ height: `${Math.max(4, (n / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

// Horizontal proportional bars for storage-by-type.
function StorageChart({ slices }: { slices: UserProfile["storageByType"] }) {
  const max = Math.max(1, ...slices.map((s) => s.bytes));
  return (
    <div className="flex flex-col gap-2">
      {slices.map((s) => (
        <div key={s.category} className="flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0 truncate text-zinc-400">{s.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              style={{ width: `${Math.max(3, (s.bytes / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right tabular-nums text-zinc-300">
            {formatBytes(s.bytes)}
          </span>
        </div>
      ))}
    </div>
  );
}

function WeekChart({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <div className="flex h-16 items-end gap-1.5">
      {weeks.map((n, i) => (
        <div
          key={i}
          title={`${n} acțiuni`}
          className="flex-1 rounded-sm bg-violet-500/40"
          style={{ height: `${Math.max(4, (n / max) * 100)}%` }}
        />
      ))}
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
      <div className="flex items-center gap-2 text-zinc-100">
        <Sparkles className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Activitatea ta</h2>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Un rezumat despre cum îți folosești cloud-ul, calculat local doar din datele tale.
      </p>

      {isLoading && !p ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Files className="h-4 w-4" />} label="Fișiere" value={<span className="tabular-nums">{p.filesCount}</span>} />
            <Stat icon={<HardDrive className="h-4 w-4" />} label="Spațiu folosit" value={formatBytes(p.storageUsed)} />
            <Stat icon={<Folder className="h-4 w-4" />} label="Foldere" value={<span className="tabular-nums">{p.foldersCount}</span>} />
            <Stat icon={TREND[p.uploadTrend].icon} label="Activitate upload" value={TREND[p.uploadTrend].label} />
            <Stat icon={<Download className="h-4 w-4" />} label="Descărcări" value={<span className="tabular-nums">{p.counts.downloads}</span>} />
            <Stat icon={<Eye className="h-4 w-4" />} label="Previzualizări" value={<span className="tabular-nums">{p.counts.previews}</span>} />
            <Stat
              icon={<Clock className="h-4 w-4" />}
              label="Activ mai ales"
              value={p.activePeriod ? `${p.activePeriod}${p.peakHour != null ? ` (~${String(p.peakHour).padStart(2, "0")}:00)` : ""}` : "—"}
            />
            <Stat icon={<CalendarDays className="h-4 w-4" />} label="Ziua activă" value={p.busiestDay ?? "—"} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-wide text-zinc-500">Când ești activ (pe ore)</p>
              <HourChart hours={p.activityByHour} peak={p.peakHour} />
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-wide text-zinc-500">Spațiu pe tip de fișier</p>
              {p.storageByType.length > 0 ? (
                <StorageChart slices={p.storageByType} />
              ) : (
                <p className="text-xs text-zinc-600">Nimic încă.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wide text-zinc-500">Activitate în ultimele 8 săptămâni</p>
            <WeekChart weeks={p.weeklyActivity} />
          </div>

          {p.topTypes.length > 0 && (
            <div className="mt-4">
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
