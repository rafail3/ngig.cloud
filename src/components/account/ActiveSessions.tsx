"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Smartphone, Tablet, LogOut } from "lucide-react";
import { deviceLabel, deviceType } from "@/lib/user-agent";
import { formatDateTime as fmt } from "@/lib/format-date";
import {
  revokeSessionAction,
  revokeOtherSessionsAction,
} from "@/app/(app)/profil/actions";
import type { ActiveSession } from "@/server/account/profile";

function typeIcon(ua: string | null) {
  const t = deviceType(ua);
  if (t === "Mobil") return <Smartphone className="h-4 w-4 text-zinc-400" />;
  if (t === "Tabletă") return <Tablet className="h-4 w-4 text-zinc-400" />;
  return <Monitor className="h-4 w-4 text-zinc-400" />;
}

export function ActiveSessions({ sessions }: { sessions: ActiveSession[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const otherCount = sessions.filter((s) => !s.is_current).length;

  function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    startTransition(async () => {
      await fn();
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-zinc-100">
          <Monitor className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">
            Sesiuni active ({sessions.length})
          </h2>
        </div>
        {otherCount > 0 && (
          <button
            type="button"
            onClick={() => run("all", revokeOtherSessionsAction)}
            disabled={pending}
            className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-60"
          >
            {busy === "all"
              ? "Se deconectează…"
              : "Deconectează toate celelalte"}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">Nicio sesiune activă.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const location = [s.city, s.country].filter(Boolean).join(", ");
            return (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-100">
                    {typeIcon(s.user_agent)}
                    <span className="truncate">{deviceLabel(s.user_agent)}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {deviceType(s.user_agent)}
                    </span>
                    {s.is_current && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                        Sesiunea curentă
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    IP: {s.ip ?? "necunoscut"}
                    {location && <span> · {location}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Activă din {fmt(s.created_at)} · ultima activitate{" "}
                    {fmt(s.last_seen)}
                  </p>
                </div>

                {!s.is_current && (
                  <button
                    type="button"
                    onClick={() => run(s.id, () => revokeSessionAction(s.id))}
                    disabled={pending}
                    className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-red-800 hover:text-red-300 disabled:opacity-60 sm:self-auto"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {busy === s.id ? "Se deconectează…" : "Deconectează"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
