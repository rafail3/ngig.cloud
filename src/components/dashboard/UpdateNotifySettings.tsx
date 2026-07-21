"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

// Compact editable row (settings style) for the "new version" broadcast: a calm
// line showing the current on/off + audience, expanding to edit.
export function UpdateNotifySettings({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveUpdateNotifySettingsAction, initial);
  useToastState(state);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [admin, setAdmin] = useState(settings.audience.includes("admin"));
  const [user, setUser] = useState(settings.audience.includes("user"));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  const audienceLabel = [admin && "Admini", user && "Utilizatori"].filter(Boolean).join(", ");
  const summary = !enabled ? "Oprit" : `Pornit · ${audienceLabel || "nimeni"}`;

  const chip = (active: boolean) =>
    `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
      active
        ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
        : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
    } disabled:cursor-not-allowed disabled:opacity-50`;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Megaphone className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Notificare de versiune nouă</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              La fiecare update, userii aleși primesc o notificare cu implementările noi.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`hidden text-sm sm:inline ${enabled ? "font-medium text-zinc-200" : "text-zinc-500"}`}>
            {summary}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              open
                ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
                : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
            }`}
          >
            {open ? "Anulează" : "Editează"}
          </button>
        </div>
      </div>

      <p className={`mt-1 pl-12 text-sm sm:hidden ${enabled ? "font-medium text-zinc-200" : "text-zinc-500"}`}>
        {summary}
      </p>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <form action={action} className="flex flex-col gap-4 pt-4 sm:pl-12">
              <input type="hidden" name="enabled" value={String(enabled)} />
              <input type="hidden" name="aud_admin" value={String(admin)} />
              <input type="hidden" name="aud_user" value={String(user)} />

              <label className="flex items-center gap-3">
                <Switch on={enabled} onFlip={() => setEnabled((v) => !v)} />
                <span className="text-sm text-zinc-300">{enabled ? "Activă" : "Oprită"}</span>
              </label>

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

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {pending ? "Se salvează…" : "Salvează"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
                >
                  Anulează
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
