"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutGrid,
  Ticket,
  Inbox,
  Users,
  Wallet,
  LifeBuoy,
  Megaphone,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { setManagerPermissionsAction } from "@/app/dashboard/(panel)/users/actions";
import { useToastState } from "@/lib/useToastState";
import type { UserActionState } from "@/lib/user-presence";

// Mirrors DASHBOARD_SECTIONS (server/admin/guard.ts) with the nav's labels and
// icons. Overview is absent on purpose — it's always visible.
const SECTIONS = [
  { key: "invites", label: "Invite codes", icon: Ticket },
  { key: "invite-requests", label: "Cereri invitații", icon: Inbox },
  { key: "users", label: "Useri", icon: Users },
  { key: "costs", label: "Costuri", icon: Wallet },
  { key: "tickets", label: "Suport", icon: LifeBuoy },
  { key: "announcements", label: "Anunțuri", icon: Megaphone },
] as const;

const initial: UserActionState = {};

// Same compact whole-row switch as the notification settings: the row is the
// button, the visual switch is a span.
function ToggleRow({
  on,
  onFlip,
  children,
}: {
  on: boolean;
  onFlip: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onFlip}
      className="flex w-fit items-center gap-3 text-left"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          on ? "bg-indigo-600" : "bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      {children}
    </button>
  );
}

// Super-admin card on a manager's detail: choose full access or a custom
// per-section allowlist for the dashboard nav/pages.
export function ManagerPermissions({
  userId,
  sections,
}: {
  userId: string;
  // Current allowlist; null = full access.
  sections: string[] | null;
}) {
  const [state, action, pending] = useActionState(setManagerPermissionsAction, initial);
  useToastState(state);

  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(sections !== null);
  const [on, setOn] = useState<Set<string>>(
    () => new Set(sections ?? SECTIONS.map((s) => s.key)),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  function cancel() {
    setCustom(sections !== null);
    setOn(new Set(sections ?? SECTIONS.map((s) => s.key)));
    setOpen(false);
  }

  const summary =
    sections === null ? (
      <span className="text-zinc-400">
        <span className="font-semibold text-indigo-300">Acces complet</span> — toate secțiunile
      </span>
    ) : (
      <span className="text-zinc-400">
        Personalizat ·{" "}
        <span className="font-semibold text-indigo-300 tabular-nums">
          {sections.length}/{SECTIONS.length}
        </span>{" "}
        secțiuni
      </span>
    );

  return (
    <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Permisiuni dashboard</h3>
        </div>
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

      <p className="mt-2 text-sm">{summary}</p>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="permissions-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 pt-4">
              {/* Preset: full access vs custom allowlist. */}
              <div
                role="radiogroup"
                aria-label="Preset de permisiuni"
                className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
              >
                {[
                  { value: false, label: "Acces complet", icon: Globe },
                  { value: true, label: "Personalizat", icon: SlidersHorizontal },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = custom === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCustom(opt.value)}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition ${
                        active
                          ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/25"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {opt.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence initial={false}>
                {custom && (
                  <motion.div
                    key="section-toggles"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-zinc-500">
                        Managerul vede doar secțiunile pornite. Overview rămâne mereu vizibil.
                      </p>
                      {SECTIONS.map((s) => {
                        const Icon = s.icon;
                        return (
                          <ToggleRow
                            key={s.key}
                            on={on.has(s.key)}
                            onFlip={() =>
                              setOn((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.key)) next.delete(s.key);
                                else next.add(s.key);
                                return next;
                              })
                            }
                          >
                            <span className="flex items-center gap-2 text-sm text-zinc-200">
                              <Icon className="h-4 w-4 text-zinc-400" /> {s.label}
                            </span>
                          </ToggleRow>
                        );
                      })}
                      {on.size === 0 && (
                        <p className="text-xs text-amber-400/80">
                          Nicio secțiune pornită — managerul va vedea doar Overview.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form action={action}>
                <input type="hidden" name="id" value={userId} />
                <input type="hidden" name="preset" value={custom ? "custom" : "full"} />
                {SECTIONS.map((s) => (
                  <input
                    key={s.key}
                    type="hidden"
                    name={`section_${s.key}`}
                    value={String(on.has(s.key))}
                  />
                ))}
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
