import Link from "next/link";
import { Upload, Download, LogIn, HardDrive, Users } from "lucide-react";
import { Avatar } from "@/components/shell/Avatar";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/format-date";
import { isOnline } from "@/lib/user-presence";
import type { ActiveUser } from "@/server/admin/stats";

// One metric chip: icon + number, with an accessible label.
function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span
      title={`${value} ${label}`}
      className="inline-flex items-center gap-1 text-xs tabular-nums text-zinc-400"
    >
      <span className="text-zinc-500">{icon}</span>
      {value}
    </span>
  );
}

// Server-rendered leaderboard of the most active users over the chosen window.
// Rows link to the user detail; the score bar is relative to the top scorer.
export function ActiveUsersLeaderboard({ users }: { users: ActiveUser[] }) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-500">
          <Users className="h-5 w-5" />
        </span>
        <p className="text-sm text-zinc-400">Nicio activitate de user în această perioadă.</p>
      </div>
    );
  }

  const top = users[0].score || 1;

  return (
    <ol className="flex flex-col gap-1.5">
      {users.map((u, i) => {
        const online = isOnline(u.lastActive);
        const location = [u.city, u.country].filter(Boolean).join(", ");
        return (
          <li key={u.userId}>
            <Link
              href={`/users/${u.userId}`}
              className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition hover:border-zinc-800 hover:bg-zinc-900/60 sm:gap-4 sm:px-3"
            >
              {/* Rank */}
              <span
                className={`w-5 shrink-0 text-center text-sm font-semibold tabular-nums ${
                  i === 0 ? "text-amber-300" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600/80" : "text-zinc-600"
                }`}
              >
                {i + 1}
              </span>

              {/* Identity */}
              <span className="relative shrink-0">
                <Avatar username={u.username} className="h-9 w-9 text-sm" />
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950 ${
                    online ? "bg-emerald-400" : "bg-zinc-600"
                  }`}
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-white">
                    {u.username}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Metric icon={<Upload className="h-3.5 w-3.5" />} value={u.uploads} label="încărcări" />
                  <Metric icon={<Download className="h-3.5 w-3.5" />} value={u.downloads} label="descărcări" />
                  <Metric icon={<LogIn className="h-3.5 w-3.5" />} value={u.logins} label="logări" />
                  <span className="hidden items-center gap-1 text-xs tabular-nums text-zinc-500 sm:inline-flex">
                    <HardDrive className="h-3.5 w-3.5" /> {formatBytes(u.storageBytes)}
                  </span>
                </div>
              </div>

              {/* Score + bar + last active */}
              <div className="flex w-24 shrink-0 flex-col items-end gap-1 sm:w-32">
                <span className="text-sm font-semibold tabular-nums text-indigo-300">{u.score}</span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <span
                    className="block h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.max(4, Math.round((u.score / top) * 100))}%` }}
                  />
                </span>
                <span className="truncate text-[11px] text-zinc-500" title={location || undefined}>
                  {u.lastActive ? formatDateTime(u.lastActive) : "—"}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
