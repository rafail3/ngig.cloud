"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldAlert, HardDrive, Clock, MapPin } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatDateTime as fmt } from "@/lib/format-date";
import { isOnline, isBlocked } from "@/lib/user-presence";
import { Avatar } from "@/components/shell/Avatar";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import type { AdminUser } from "@/server/admin/users";

function location(u: AdminUser): string {
  return [u.last_city, u.last_country].filter(Boolean).join(", ") || "—";
}

// Avatar with an online/offline status dot in the corner.
function UserAvatar({ username, online, size = "h-9 w-9 text-sm" }: { username: string; online: boolean; size?: string }) {
  return (
    <span className="relative shrink-0">
      <Avatar username={username} className={size} />
      <span
        title={online ? "Online" : "Offline"}
        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950 ${
          online ? "bg-emerald-400" : "bg-zinc-600"
        }`}
      />
    </span>
  );
}

function UserIdentity({ u, online }: { u: AdminUser; online: boolean }) {
  const blocked = isBlocked(u.blocked_until);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar username={u.username ?? "?"} online={online} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium text-zinc-100">{u.username}</span>
          <RoleBadge role={u.role} superAdmin={u.is_super_admin} />
          {blocked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
              <ShieldAlert className="h-3 w-3" /> Blocat
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-500">{u.email}</p>
      </div>
    </div>
  );
}

export function UsersTable({ users }: { users: AdminUser[] }) {
  const router = useRouter();

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center text-sm text-zinc-500">
        Niciun user încă.
      </div>
    );
  }

  return (
    <div>
      {/* ===== Desktop table ===== */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/30 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800/70 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3.5 font-medium">Utilizator</th>
              <th className="px-4 py-3.5 font-medium">Stocare</th>
              <th className="px-4 py-3.5 font-medium">Ultima conectare</th>
              <th className="px-4 py-3.5 font-medium">Locație</th>
              <th className="px-4 py-3.5 font-medium">Creat</th>
              <th className="w-10 px-4 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {users.map((u) => {
              const online = isOnline(u.last_seen_at);
              return (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/users/${u.id}`)}
                  className="group cursor-pointer text-zinc-300 transition-colors hover:bg-zinc-800/30"
                >
                  <td className="px-5 py-3.5">
                    <UserIdentity u={u} online={online} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium tabular-nums text-zinc-200">{formatBytes(u.total_size)}</span>
                    <span className="block text-xs tabular-nums text-zinc-500">{u.file_count} fișiere</span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-400">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3.5 text-zinc-400">{location(u)}</td>
                  <td className="px-4 py-3.5 text-zinc-400">{fmt(u.account_created)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-zinc-600 transition-colors group-hover:text-indigo-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile / tablet cards ===== */}
      <div className="flex flex-col gap-3 lg:hidden">
        {users.map((u) => {
          const online = isOnline(u.last_seen_at);
          return (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="block rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700 active:border-zinc-700"
            >
              <UserIdentity u={u} online={online} />
              <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-zinc-800/60 pt-3.5 text-xs">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <span className="text-zinc-300">{formatBytes(u.total_size)} · {u.file_count} fișiere</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <span className="truncate text-zinc-300">{fmt(u.last_sign_in_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <span className="truncate text-zinc-300">{location(u)}</span>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
