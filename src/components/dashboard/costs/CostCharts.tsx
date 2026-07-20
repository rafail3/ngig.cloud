"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  PieChart,
  Pie,
} from "recharts";
import { formatUsd, type UserCost, type PlatformCost } from "@/lib/pricing";
import { COST_CARD, chartTooltipStyle } from "./styles";

// Render only after mount so recharts plays its entrance animation (a
// server-rendered chart would hydrate already drawn).
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${COST_CARD} p-4 sm:p-5`}>
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h2>
      {children}
    </section>
  );
}

// Top users by total cost — horizontal bars, easiest read for a ranked compare.
export function TopUsersChart({ users }: { users: UserCost[] }) {
  const mounted = useMounted();
  const data = users
    .filter((u) => u.totalCost > 0)
    .slice(0, 8)
    .map((u) => ({ name: u.username ?? "—", cost: u.totalCost }));

  return (
    <Card title="Top utilizatori după cost">
      {data.length === 0 ? (
        <Empty>Niciun cost atribuit încă.</Empty>
      ) : (
        <div className="h-72 w-full">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="costBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={chartTooltipStyle}
                  formatter={(v) => [formatUsd(Number(v)), "Cost / lună"]}
                />
                <Bar
                  dataKey="cost"
                  radius={[4, 4, 4, 4]}
                  isAnimationActive
                  animationDuration={900}
                  activeBar={{ stroke: "var(--color-indigo-300)", strokeWidth: 2 }}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill="url(#costBar)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Card>
  );
}

// Where the platform bill comes from — storage vs egress vs transactions.
const COMPOSITION_COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

export function CompositionChart({ platform }: { platform: PlatformCost }) {
  const mounted = useMounted();
  const slices = [
    { name: "Stocare", value: platform.storageCost },
    { name: "Egress", value: platform.egressCost },
    { name: "Tranzacții", value: platform.transactionsCost },
  ].filter((s) => s.value > 0);

  return (
    <Card title="Compoziția costului">
      {slices.length === 0 ? (
        <Empty>Nu există cost de afișat pentru această perioadă.</Empty>
      ) : (
        <div className="flex h-72 flex-col">
          <div className="min-h-0 flex-1">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="82%"
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive
                    animationDuration={900}
                  >
                    {slices.map((s, i) => (
                      <Cell key={s.name} fill={COMPOSITION_COLORS[i % COMPOSITION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatUsd(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {slices.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: COMPOSITION_COLORS[i % COMPOSITION_COLORS.length] }}
                />
                {s.name} ({formatUsd(s.value)})
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
