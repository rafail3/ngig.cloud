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
} from "recharts";
import type { ActiveUser } from "@/server/admin/stats";

// Electric-blue → indigo ramp; the top scorer gets the brightest bar, the rest
// step down so rank reads at a glance. Mirrors the Overview palette.
const BAR_COLORS = ["#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81"];

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
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide domain={[0, (max: number) => Math.max(4, max)]} />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "#ffffff08" }}
            />
            <Bar dataKey="score" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900}>
              {chart.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
