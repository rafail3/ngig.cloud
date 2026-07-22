"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import type { ActiveUser } from "@/server/admin/stats";

// Per-bar horizontal gradients (bright indigo→sky for #1, stepping darker down
// the ranks) so the podium reads at a glance. Mirrors the Overview palette.
const BAR_GRADIENTS: [string, string][] = [
  ["#818cf8", "#38bdf8"],
  ["#6366f1", "#4f46e5"],
  ["#4f46e5", "#4338ca"],
  ["#4338ca", "#3730a3"],
  ["#3730a3", "#312e81"],
];

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 12,
  color: "#fafafa",
  fontSize: 12,
};

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // One-shot mount flag so recharts plays its entrance animation on the client.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

type Row = {
  name: string;
  score: number;
  uploads: number;
  downloads: number;
  logins: number;
};

// recharts injects active/payload at runtime; typed permissively to stay
// compatible across recharts' shifting tooltip prop shapes.
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="mb-1 font-semibold text-zinc-100">{r.name}</p>
      <p className="text-indigo-300">
        Scor <span className="font-semibold tabular-nums">{r.score}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-400">
        {r.uploads} încărcări · {r.downloads} descărcări · {r.logins} logări
      </p>
    </div>
  );
}

// Horizontal activity-score ranking — the visual centerpiece of the section,
// styled to match the other Overview charts (dark, animated, tooltip).
export function ActiveUsersChart({ users }: { users: ActiveUser[] }) {
  const mounted = useMounted();
  if (users.length === 0) return null;

  const chart: Row[] = users.map((u) => ({
    name: u.username,
    score: u.score,
    uploads: u.uploads,
    downloads: u.downloads,
    logins: u.logins,
  }));

  // Give each bar breathing room; grow with the count.
  const height = Math.max(180, chart.length * 44 + 16);

  return (
    <div className="w-full" style={{ height }}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chart}
            layout="vertical"
            margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
            barCategoryGap="26%"
          >
            <defs>
              {BAR_GRADIENTS.map(([from, to], i) => (
                <linearGradient key={i} id={`au-bar-${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={from} />
                  <stop offset="100%" stopColor={to} />
                </linearGradient>
              ))}
            </defs>
            <XAxis type="number" hide domain={[0, (max: number) => Math.max(4, max * 1.08)]} />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              tick={{ fill: "#d4d4d8", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="score" radius={[0, 7, 7, 0]} isAnimationActive animationDuration={900} maxBarSize={26}>
              {chart.map((_, i) => (
                <Cell key={i} fill={`url(#au-bar-${Math.min(i, BAR_GRADIENTS.length - 1)})`} />
              ))}
              <LabelList
                dataKey="score"
                position="right"
                offset={8}
                fill="#e4e4e7"
                fontSize={12}
                className="font-semibold tabular-nums"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
