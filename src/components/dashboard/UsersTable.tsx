"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatDateTime as fmt } from "@/lib/format-date";
import { isOnline, isBlocked } from "@/lib/user-presence";
import type { AdminUser } from "@/server/admin/users";

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        online ? "bg-emerald-400" : "bg-zinc-600"
      }`}
    />
  );
}

function location(u: AdminUser): string {
  return [u.last_city, u.last_country].filter(Boolean).join(", ") || "—";
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
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/20 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/40 text-xs font-medium text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Creat</th>
              <th className="px-4 py-3 font-medium">Ultima conectare</th>
              <th className="px-4 py-3 font-medium">Spațiu</th>
              <th className="px-4 py-3 font-medium">Fișiere</th>
              <th className="px-4 py-3 font-medium">Locație</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {users.map((u) => {
              const online = isOnline(u.last_seen_at);
              const blocked = isBlocked(u.blocked_until);
              return (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/users/${u.id}`)}
                  className="cursor-pointer text-zinc-300 transition-colors hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <OnlineDot online={online} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium text-zinc-100">
                          <span className="truncate">{u.username}</span>
                          {u.role === "admin" && (
                            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase text-indigo-300">
                              admin
                            </span>
                          )}
                          {blocked && (
                            <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase text-red-300">
                              <ShieldAlert className="h-3 w-3" /> blocat
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-zinc-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{fmt(u.account_created)}</td>
                  <td className="px-4 py-3 text-zinc-400">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3">{formatBytes(u.total_size)}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.file_count}</td>
                  <td className="px-4 py-3 text-zinc-400">{location(u)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/users/${u.id}`}
                      className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      Detalii <ChevronRight className="h-4 w-4" />
                    </Link>
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
          const blocked = isBlocked(u.blocked_until);
          return (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="block rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <OnlineDot online={online} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-zinc-100">
                      <span className="truncate">{u.username}</span>
                      {u.role === "admin" && (
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase text-indigo-300">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{u.email}</p>
                  </div>
                </div>
                {blocked && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase text-red-300">
                    <ShieldAlert className="h-3 w-3" /> blocat
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-zinc-500">Spațiu</dt>
                  <dd className="text-zinc-300">{formatBytes(u.total_size)} · {u.file_count} fișiere</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Ultima conectare</dt>
                  <dd className="text-zinc-300">{fmt(u.last_sign_in_at)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Locație</dt>
                  <dd className="text-zinc-300">{location(u)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Creat</dt>
                  <dd className="text-zinc-300">{fmt(u.account_created)}</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
