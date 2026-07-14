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

function TypeIcon({ ua }: { ua: string | null }) {
  const t = deviceType(ua);
  const Icon = t === "Mobil" ? Smartphone : t === "Tabletă" ? Tablet : Monitor;
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800/60"
    >
      <Icon className="h-[18px] w-[18px] text-zinc-400" />
    </span>
  );
}

// Same settings-card grammar as the account forms: header row + one divided
// row per session, no nested boxes.
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
    <section className="divide-y divide-zinc-800/50 rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            Sesiuni active
            <span className="ml-1.5 font-normal tabular-nums text-zinc-500">({sessions.length})</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Dispozitivele conectate acum la contul tău.
          </p>
        </div>
        {otherCount > 0 && (
          <button
            type="button"
            onClick={() => run("all", revokeOtherSessionsAction)}
            disabled={pending}
            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-60"
          >
            {busy === "all"
              ? "Se deconectează…"
              : "Deconectează toate celelalte"}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500 sm:px-6">Nicio sesiune activă.</p>
      ) : (
        sessions.map((s) => {
          const location = [s.city, s.country].filter(Boolean).join(", ");
          return (
            <div
              key={s.id}
              className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <TypeIcon ua={s.user_agent} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-100">
                    <span className="truncate">{deviceLabel(s.user_agent)}</span>
                    <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {deviceType(s.user_agent)}
                    </span>
                    {s.is_current && (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Sesiunea curentă
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    IP: {s.ip ?? "necunoscut"}
                    {location && <span> · {location}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Activă din {fmt(s.created_at)} · ultima activitate{" "}
                    {fmt(s.last_seen)}
                  </p>
                </div>
              </div>

              {!s.is_current && (
                <button
                  type="button"
                  onClick={() => run(s.id, () => revokeSessionAction(s.id))}
                  disabled={pending}
                  className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60 sm:self-auto"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {busy === s.id ? "Se deconectează…" : "Deconectează"}
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
