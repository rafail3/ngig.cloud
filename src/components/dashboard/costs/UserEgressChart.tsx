"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatBytes } from "@/lib/format";
import { formatDateShort as shortDay } from "@/lib/format-date";
import { chartTooltipStyle } from "./styles";

type EgressDay = { day: string; bytes: number };

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

// Egress over the selected period for a single user — the "flux" as a daily area.
export function UserEgressChart({ data }: { data: EgressDay[] }) {
  const mounted = useMounted();
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Niciun egress în această perioadă.
      </div>
    );
  }
  const chart = data.map((d) => ({ day: shortDay(d.day), bytes: d.bytes }));

  return (
    <div className="h-64 w-full">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{ top: 10, right: 12, left: -2, bottom: 8 }}>
            <defs>
              <linearGradient id="egressArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "var(--color-zinc-500)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--color-zinc-500)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => formatBytes(v)}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v) => [formatBytes(Number(v)), "Egress"]}
            />
            <Area
              type="monotone"
              dataKey="bytes"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#egressArea)"
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
