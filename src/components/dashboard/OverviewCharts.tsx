"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { FileType, UploadDay, LoginDay } from "@/server/admin/stats";
import { formatDateShort as shortDay } from "@/lib/format-date";

const COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#22d3ee", "#34d399", "#f59e0b", "#f43f5e"];

const CATEGORY_LABEL: Record<string, string> = {
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

function label(cat: string): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

// Render only after mount so the chart draws its entrance animation on every
// page load / refresh (server-rendered SVG would otherwise appear pre-drawn).
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // Intentional one-shot mount flag so recharts plays its entrance animation on
  // the client (a server-rendered chart would hydrate already drawn).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-zinc-500">{children}</div>
  );
}

export function FileTypesChart({ data }: { data: FileType[] }) {
  const mounted = useMounted();
  if (data.length === 0) return <Empty>Niciun fișier încă.</Empty>;
  const chart = data.map((d) => ({ name: label(d.category), value: d.count }));

  return (
    <div className="flex h-72 flex-col">
      <div className="min-h-0 flex-1">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chart}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive
                animationDuration={900}
              >
                {chart.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {chart.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </div>
  );
}

function TimeAreaChart({
  data,
  color,
  gradientId,
  emptyText,
}: {
  data: { day: string; count: number }[];
  color: string;
  gradientId: string;
  emptyText: string;
}) {
  const mounted = useMounted();
  if (data.length === 0) return <Empty>{emptyText}</Empty>;
  const chart = data.map((d) => ({ day: shortDay(d.day), count: d.count }));

  return (
    <div className="h-72 w-full">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{ top: 10, right: 12, left: -6, bottom: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
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
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax))]}
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function UploadsChart({ data }: { data: UploadDay[] }) {
  return (
    <TimeAreaChart
      data={data}
      color="#818cf8"
      gradientId="up"
      emptyText="Niciun upload în perioada selectată."
    />
  );
}

export function LoginsChart({ data }: { data: LoginDay[] }) {
  return (
    <TimeAreaChart
      data={data}
      color="#34d399"
      gradientId="logins"
      emptyText="Nicio accesare în perioada selectată."
    />
  );
}
