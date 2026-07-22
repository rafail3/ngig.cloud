"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X,
  Upload,
  Download,
  Eye,
  Search,
  LogIn,
  HardDrive,
  Files,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Avatar } from "@/components/shell/Avatar";
import { getUserActivityAction } from "@/app/dashboard/(panel)/users/actions";
import { formatBytes } from "@/lib/format";
import { formatDateTime, formatDateShort } from "@/lib/format-date";
import type { UserActivityDetail } from "@/server/admin/stats";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#22c55e", "#ef4444", "#a1a1aa"];
const TYPE_LABEL: Record<string, string> = {
  image: "Imagini",
  video: "Video",
  audio: "Audio",
  application: "Documente",
  text: "Text",
  altele: "Altele",
};
const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 12,
  color: "#fafafa",
  fontSize: 12,
};

function Kpi({
  icon,
  tint,
  value,
  label,
}: {
  icon: React.ReactNode;
  tint: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3">
      <div className={`flex items-center gap-1.5 ${tint}`}>{icon}</div>
      <p className="mt-2 text-xl font-bold tabular-nums text-zinc-50">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-900 py-2 last:border-0">
      <span className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="text-zinc-600">{icon}</span>
        {label}
      </span>
      <span className="truncate text-xs font-medium text-zinc-200">{value}</span>
    </div>
  );
}

// Insights overlay for one user, opened from the Overview leaderboard. Shows
// their activity in the selected window — counts, daily trend, file mix — not
// the users-page account controls.
export function UserInsightsModal({
  userId,
  username,
  days,
  onClose,
}: {
  userId: string;
  username: string;
  days: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<UserActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await getUserActivityAction(userId, days);
      if (res.ok) setDetail(res.data);
      else setError(res.error);
    });
  }, [userId, days]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = detail?.counts;
  const location = [detail?.city, detail?.country].filter(Boolean).join(", ");
  const daily = (detail?.daily ?? []).map((d) => ({
    day: formatDateShort(d.day),
    actions: d.actions,
    logins: d.logins,
  }));
  const types = (detail?.fileTypes ?? []).map((t) => ({
    name: TYPE_LABEL[t.category] ?? t.category,
    value: t.count,
  }));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Activitate ${username}`}
          className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/40 px-4 py-4 sm:px-6">
            <Avatar username={detail?.username ?? username} className="h-11 w-11 text-base" />
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 truncate text-base font-semibold text-zinc-50">
                {detail?.username ?? username}
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                  ultimele {days} zile
                </span>
              </h2>
              {location && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                  <MapPin className="h-3 w-3" /> {location}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
            {error ? (
              <p className="py-12 text-center text-sm text-red-300">{error}</p>
            ) : !detail ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
                  ))}
                </div>
                <div className="h-56 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* KPI tiles */}
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                  <Kpi icon={<Upload className="h-4 w-4" />} tint="text-blue-400" value={c!.uploads} label="Încărcări" />
                  <Kpi icon={<Download className="h-4 w-4" />} tint="text-emerald-400" value={c!.downloads} label="Descărcări" />
                  <Kpi icon={<Eye className="h-4 w-4" />} tint="text-sky-400" value={c!.previews} label="Previzualizări" />
                  <Kpi icon={<Search className="h-4 w-4" />} tint="text-amber-400" value={c!.searches} label="Căutări" />
                  <Kpi icon={<LogIn className="h-4 w-4" />} tint="text-violet-400" value={c!.logins} label="Logări" />
                </div>

                {/* Daily activity */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">Activitate zilnică</h3>
                  <div className="h-56 w-full rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                        <defs>
                          <linearGradient id="ins-actions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="ins-logins" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "#71717a", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          domain={[0, (m: number) => Math.max(4, Math.ceil(m))]}
                          tick={{ fill: "#71717a", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="actions" name="Acțiuni" stroke="#818cf8" strokeWidth={2} fill="url(#ins-actions)" isAnimationActive animationDuration={800} />
                        <Area type="monotone" dataKey="logins" name="Logări" stroke="#34d399" strokeWidth={2} fill="url(#ins-logins)" isAnimationActive animationDuration={800} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Types + facts */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-zinc-200">Tipuri de fișiere</h3>
                    {types.length === 0 ? (
                      <p className="flex h-40 items-center justify-center text-sm text-zinc-500">Niciun fișier.</p>
                    ) : (
                      <div className="flex h-48 flex-col">
                        <div className="min-h-0 flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={types} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none" isAnimationActive animationDuration={800}>
                                {types.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                          {types.map((d, i) => (
                            <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              {d.name} ({d.value})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">Detalii</h3>
                    <dl>
                      <Fact icon={<HardDrive className="h-3.5 w-3.5" />} label="Stocare" value={formatBytes(detail.storage)} />
                      <Fact icon={<Files className="h-3.5 w-3.5" />} label="Fișiere" value={String(detail.fileCount)} />
                      <Fact icon={<Calendar className="h-3.5 w-3.5" />} label="Membru din" value={detail.memberSince ? formatDateTime(detail.memberSince) : "—"} />
                      <Fact icon={<Clock className="h-3.5 w-3.5" />} label="Ultima activitate" value={detail.lastSeen ? formatDateTime(detail.lastSeen) : "—"} />
                    </dl>
                  </section>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
