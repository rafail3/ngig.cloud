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

// Compact, professional editable row for the "new version" broadcast: a calm
// line with the current on/off + audience, expanding to a clean edit panel.
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

  function cancel() {
    setEnabled(settings.enabled);
    setAdmin(settings.audience.includes("admin"));
    setUser(settings.audience.includes("user"));
    setOpen(false);
  }

  const audienceLabel = [admin && "Admini", user && "Utilizatori"].filter(Boolean).join(", ");
  const summary = () =>
    !enabled ? (
      <span className="text-zinc-500">Oprit</span>
    ) : (
      <span className="text-zinc-400">
        Pornit · <span className="font-semibold text-indigo-300">{audienceLabel || "nimeni"}</span>
      </span>
    );

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
              Anunță userii la fiecare update, cu implementările noi.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm sm:inline">{summary()}</span>
          <button
            type="button"
            onClick={() => (open ? cancel() : setOpen(true))}
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

      <p className="mt-1 pl-12 text-sm sm:hidden">{summary()}</p>

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
            <div className="flex flex-col gap-4 pt-4 sm:pl-12">
              {/* On/off */}
              <div className="flex max-w-md items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Activă</p>
                  <p className="text-xs text-zinc-500">Trimite notificarea la fiecare versiune nouă.</p>
                </div>
                <Switch on={enabled} onFlip={() => setEnabled((v) => !v)} />
              </div>

              {/* Audience — only relevant when on */}
              {enabled && (
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-400">Audiență</p>
                  <div className="flex max-w-md flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-2.5">
                      <span className="flex items-center gap-2 text-sm text-zinc-200">
                        <Shield className="h-4 w-4 text-zinc-400" /> Admini
                      </span>
                      <Switch on={admin} onFlip={() => setAdmin((v) => !v)} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-2.5">
                      <span className="flex items-center gap-2 text-sm text-zinc-200">
                        <User className="h-4 w-4 text-zinc-400" /> Utilizatori
                      </span>
                      <Switch on={user} onFlip={() => setUser((v) => !v)} />
                    </div>
                  </div>
                  {!admin && !user && (
                    <p className="mt-1.5 text-xs text-amber-400/80">Alege cel puțin un grup.</p>
                  )}
                </div>
              )}

              <form action={action}>
                <input type="hidden" name="enabled" value={String(enabled)} />
                <input type="hidden" name="aud_admin" value={String(admin)} />
                <input type="hidden" name="aud_user" value={String(user)} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {pending ? "Se salvează…" : "Salvează"}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
