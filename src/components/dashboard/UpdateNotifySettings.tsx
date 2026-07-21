"use client";

import { useActionState, useState } from "react";
import { Megaphone, Shield, User } from "lucide-react";
import { saveUpdateNotifySettingsAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import type { SettingsState } from "@/lib/settings-state";
import type { UpdateNotifySettings as Settings } from "@/server/updates/service";

const initial: SettingsState = {};

function Switch({ on, onFlip }: { on: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onFlip}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        on ? "bg-indigo-600" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// Toggle + audience for the "new version" broadcast that fires once per deploy.
export function UpdateNotifySettings({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveUpdateNotifySettingsAction, initial);
  useToastState(state);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [admin, setAdmin] = useState(settings.audience.includes("admin"));
  const [user, setUser] = useState(settings.audience.includes("user"));

  const chip = (active: boolean) =>
    `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
      active
        ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
        : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
    } disabled:cursor-not-allowed disabled:opacity-50`;

  return (
    <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Megaphone className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Notificare de versiune nouă</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              La fiecare update, userii aleși primesc o notificare cu implementările noi.
            </p>
          </div>
        </div>
        <Switch on={enabled} onFlip={() => setEnabled((v) => !v)} />
      </div>

      <form action={action} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="enabled" value={String(enabled)} />
        <input type="hidden" name="aud_admin" value={String(admin)} />
        <input type="hidden" name="aud_user" value={String(user)} />

        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">Cine primește</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!enabled} onClick={() => setAdmin((v) => !v)} className={chip(admin)}>
              <Shield className="h-4 w-4" /> Admini
            </button>
            <button type="button" disabled={!enabled} onClick={() => setUser((v) => !v)} className={chip(user)}>
              <User className="h-4 w-4" /> Utilizatori
            </button>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {pending ? "Se salvează…" : "Salvează"}
          </button>
        </div>
      </form>
    </section>
  );
}
