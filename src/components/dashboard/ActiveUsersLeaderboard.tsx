import Link from "next/link";
import { Upload, Download, LogIn, HardDrive, Users, ChevronRight, MapPin } from "lucide-react";
import { Avatar } from "@/components/shell/Avatar";
import { ActiveUsersChart } from "@/components/dashboard/ActiveUsersChart";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/format-date";
import { isOnline } from "@/lib/user-presence";
import type { ActiveUser } from "@/server/admin/stats";

// Podium accents for the top three; everyone else gets a plain muted index.
const MEDAL = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 ring-amber-300/40",
  "bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-800 ring-zinc-300/40",
  "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 ring-amber-600/40",
];

// One metric: a subtle pill with a tinted icon and its count.
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

// Ranked list of the most active users over the chosen window: an activity-score
// bar chart on top, then a detailed per-user breakdown. Rows link to the detail.
export function ActiveUsersLeaderboard({ users }: { users: ActiveUser[] }) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-500">
          <Users className="h-5 w-5" />
        </span>
        <p className="text-sm text-zinc-400">Nicio activitate de user în această perioadă.</p>
      </div>
    );
  }

  const top = users[0].score || 1;

  return (
    <div className="flex flex-col gap-5">
      <ActiveUsersChart users={users} />

      <div className="h-px bg-zinc-800/70" />

      <ol className="flex flex-col gap-1">
        {users.map((u, i) => {
          const online = isOnline(u.lastActive);
          const location = [u.city, u.country].filter(Boolean).join(", ");
          const pct = Math.max(3, Math.round((u.score / top) * 100));
          return (
            <li key={u.userId}>
              <Link
                href={`/users/${u.userId}`}
                className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition hover:border-zinc-800 hover:bg-zinc-900/70 sm:gap-4 sm:px-3"
              >
                {/* Rank */}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-1 ring-inset ${
                    i < 3 ? MEDAL[i] : "bg-zinc-800/60 text-zinc-500 ring-zinc-700/50"
                  }`}
                >
                  {i + 1}
                </span>

                {/* Identity */}
                <span className="relative shrink-0">
                  <Avatar username={u.username} className="h-10 w-10 text-sm" />
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
                      {u.username}
                    </p>
                    {location && (
                      <span className="hidden items-center gap-0.5 truncate text-[11px] text-zinc-500 sm:inline-flex">
                        <MapPin className="h-3 w-3" /> {location}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Metric icon={<Upload className="h-3.5 w-3.5" />} value={u.uploads} label="încărcări" tint="text-blue-400" />
                    <Metric icon={<Download className="h-3.5 w-3.5" />} value={u.downloads} label="descărcări" tint="text-emerald-400" />
                    <Metric icon={<LogIn className="h-3.5 w-3.5" />} value={u.logins} label="logări" tint="text-violet-400" />
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">
                      <HardDrive className="h-3.5 w-3.5 text-zinc-500" /> {formatBytes(u.storageBytes)}
                    </span>
                  </div>
                </div>

                {/* Score + bar + last active */}
                <div className="flex w-24 shrink-0 flex-col items-end gap-1 sm:w-36">
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold tabular-nums text-indigo-300">{u.score}</span>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-600">scor</span>
                  </div>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="truncate text-[11px] text-zinc-500">
                    {u.lastActive ? formatDateTime(u.lastActive) : "—"}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-400" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
