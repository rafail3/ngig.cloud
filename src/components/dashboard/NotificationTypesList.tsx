"use client";

import { useState, useTransition } from "react";
import { User, Shield, Users } from "lucide-react";
import { setNotificationEnabledAction } from "@/app/dashboard/(panel)/notifications/actions";
import type {
  NotificationAudience,
  NotificationTypeStatus,
} from "@/server/notifications/catalog";

const AUDIENCE: Record<
  NotificationAudience,
  { label: string; icon: React.ReactNode; cls: string }
> = {
  user: {
    label: "Utilizator",
    icon: <User className="h-3 w-3" />,
    cls: "border-sky-800/60 bg-sky-950/40 text-sky-300",
  },
  admin: {
    label: "Admin",
    icon: <Shield className="h-3 w-3" />,
    cls: "border-violet-800/60 bg-violet-950/40 text-violet-300",
  },
  both: {
    label: "Ambii",
    icon: <Users className="h-3 w-3" />,
    cls: "border-zinc-700/60 bg-zinc-900/60 text-zinc-300",
  },
};

function AudienceBadge({ audience }: { audience: NotificationAudience }) {
  const a = AUDIENCE[audience];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${a.cls}`}
    >
      {a.icon}
      {a.label}
    </span>
  );
}

function Toggle({ enabled, onFlip, pending }: { enabled: boolean; onFlip: () => void; pending: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onFlip}
      disabled={pending}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
        enabled ? "bg-indigo-600" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Row({ t }: { t: NotificationTypeStatus }) {
  const [on, setOn] = useState(t.enabled);
  const [pending, start] = useTransition();

  function flip() {
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        await setNotificationEnabledAction(t.key, next);
      } catch {
        // Revert the optimistic flip on failure.
        setOn(!next);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-900 px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-zinc-100">{t.label}</p>
          <AudienceBadge audience={t.audience} />
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>
      </div>
      <Toggle enabled={on} onFlip={flip} pending={pending} />
    </div>
  );
}

export function NotificationTypesList({ types }: { types: NotificationTypeStatus[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      {types.map((t) => (
        <Row key={t.key} t={t} />
      ))}
    </div>
  );
}
