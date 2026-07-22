"use client";

import { useState } from "react";
import { Upload, Download, LogIn, HardDrive, MapPin, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/shell/Avatar";
import { UserInsightsModal } from "@/components/dashboard/UserInsightsModal";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/format-date";
import { isOnline } from "@/lib/user-presence";
import type { ActiveUser } from "@/server/admin/stats";

// Podium ranks are bare numerals with a metallic gradient (gold/silver/bronze
// via bg-clip-text); the rest are plain muted numbers. No tiles, no bullets.
const RANK_TEXT = [
  "bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent",
  "bg-gradient-to-b from-zinc-100 to-zinc-400 bg-clip-text text-transparent",
  "bg-gradient-to-b from-orange-300 to-orange-600 bg-clip-text text-transparent",
];

function Metric({
  icon,
  value,
  label,
  tint,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <span
      title={`${value} ${label}`}
      className="inline-flex items-center gap-1 rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-xs tabular-nums text-zinc-300"
    >
      <span className={tint}>{icon}</span>
      {value}
    </span>
  );
}

// A single leaderboard row. Clicking opens the per-user insights modal (activity
// for the window) — not the users-page account controls.
export function ActiveUserRow({
  user,
  rank,
  top,
  days,
}: {
  user: ActiveUser;
  rank: number; // 0-based
  top: number;
  days: number;
}) {
  const [open, setOpen] = useState(false);
  const online = isOnline(user.lastActive);
  const location = [user.city, user.country].filter(Boolean).join(", ");
  const pct = Math.max(3, Math.round((user.score / top) * 100));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Hover: zinc-900/70 mirrors to near-white in light mode (invisible on
        // the white card), so light gets an explicit non-mirrored tint.
        className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 text-left transition hover:border-black/[0.06] hover:bg-black/[0.03] dark:hover:border-zinc-800 dark:hover:bg-zinc-900/70 sm:gap-4 sm:px-3"
      >
        {/* Rank numeral */}
        <span
          className={`w-8 shrink-0 text-center text-xl font-extrabold tabular-nums leading-none ${
            rank < 3 ? RANK_TEXT[rank] : "text-zinc-600"
          }`}
        >
          {rank + 1}
        </span>

        {/* Identity */}
        <span className="relative shrink-0">
          <Avatar username={user.username} className="h-10 w-10 text-sm" />
          <span
            aria-hidden
            title={online ? "Online" : "Offline"}
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-zinc-950 ${
              online ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-white">
              {user.username}
            </p>
            {location && (
              <span className="hidden items-center gap-0.5 truncate text-[11px] text-zinc-500 sm:inline-flex">
                <MapPin className="h-3 w-3" /> {location}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Metric icon={<Upload className="h-3.5 w-3.5" />} value={user.uploads} label="încărcări" tint="text-blue-400" />
            <Metric icon={<Download className="h-3.5 w-3.5" />} value={user.downloads} label="descărcări" tint="text-emerald-400" />
            <Metric icon={<LogIn className="h-3.5 w-3.5" />} value={user.logins} label="logări" tint="text-violet-400" />
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">
              <HardDrive className="h-3.5 w-3.5 text-zinc-500" /> {formatBytes(user.storageBytes)}
            </span>
          </div>
        </div>

        {/* Score + bar + last active */}
        <div className="flex w-24 shrink-0 flex-col items-end gap-1 sm:w-36">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold tabular-nums text-indigo-300">{user.score}</span>
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">scor</span>
          </div>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="truncate text-[11px] text-zinc-500">
            {user.lastActive ? formatDateTime(user.lastActive) : "—"}
          </span>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-400" />
      </button>

      {open && (
        <UserInsightsModal
          userId={user.userId}
          username={user.username}
          days={days}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
