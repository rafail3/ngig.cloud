"use client";

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
import type { FileType, UploadDay } from "@/server/admin/stats";

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

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
}

export function FileTypesChart({ data }: { data: FileType[] }) {
  if (data.length === 0) {
    return <Empty>Niciun fișier încă.</Empty>;
  }
  const chart = data.map((d) => ({ name: label(d.category), value: d.count }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chart}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            stroke="none"
          >
            {chart.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
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

export function UploadsChart({ data }: { data: UploadDay[] }) {
  if (data.length === 0) {
    return <Empty>Niciun upload în perioada selectată.</Empty>;
  }
  const chart = data.map((d) => ({ day: shortDay(d.day), count: d.count }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} fill="url(#up)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-zinc-500">{children}</div>
  );
}
