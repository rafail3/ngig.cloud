"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HardDrive, FileText, User, Database, Users, type LucideIcon } from "lucide-react";
import { saveSettingAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import { splitUnit } from "@/lib/bytes";
import { formatBytes } from "@/lib/format";
import type { SettingsState } from "@/lib/settings-state";
import type { GlobalSettings } from "@/server/admin/settings";

const initial: SettingsState = {};
const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";

type Field = keyof GlobalSettings;

// One editable setting row (Stripe/Linear style): a calm line showing the
// current value, with an inline edit form that expands only when asked. Each row
// saves independently.
function SettingRow({
  field,
  kind,
  icon: Icon,
  label,
  description,
  current,
}: {
  field: Field;
  kind: "bytes" | "count";
  icon: LucideIcon;
  label: string;
  description: string;
  current: number | null;
}) {
  const [state, action, pending] = useActionState(saveSettingAction, initial);
  const [open, setOpen] = useState(false);
  useToastState(state);

  // Collapse after a successful save.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  const bytes = splitUnit(current);
  const display =
    current == null
      ? "Nelimitat"
      : kind === "bytes"
        ? formatBytes(current)
        : `${current} conturi`;

  return (
    <div className="p-4 sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">{label}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`hidden tabular-nums sm:inline ${
              current == null ? "text-sm text-zinc-500" : "text-sm font-medium text-zinc-200"
            }`}
          >
            {display}
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

      {/* Current value on mobile (the desktop shows it inline above). */}
      <p className={`mt-1 pl-12 text-sm sm:hidden ${current == null ? "text-zinc-500" : "font-medium text-zinc-200"}`}>
        {display}
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
            <form action={action} className="flex flex-col gap-3 pt-4 sm:pl-12">
              <input type="hidden" name="field" value={field} />
              <div className="flex gap-2 sm:max-w-md">
                <input
                  name="value"
                  type="text"
                  inputMode={kind === "count" ? "numeric" : "decimal"}
                  defaultValue={kind === "bytes" ? bytes.value : (current ?? "")}
                  placeholder="nelimitat"
                  autoFocus
                  className={inputCls}
                />
                {kind === "bytes" && (
                  <select name="unit" defaultValue={bytes.unit} className={`${inputCls} w-24`}>
                    <option value="MB" className="bg-zinc-900">MB</option>
                    <option value="GB" className="bg-zinc-900">GB</option>
                  </select>
                )}
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
                <span className="text-xs text-zinc-500">Gol = nelimitat</span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// A titled group of setting rows. The title is a section heading ABOVE the card
// (bold, plain inline icon) so it reads as a category — clearly distinct from
// the setting rows inside, which carry icon chips + an Editează button.
function Group({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 px-1 text-base font-semibold text-zinc-100">
        <Icon className="h-4 w-4 text-zinc-400" />
        {title}
      </h3>
      <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40 divide-y divide-zinc-800/70">
        {children}
      </div>
    </section>
  );
}

export function SettingsForm({ settings }: { settings: GlobalSettings }) {
  return (
    <div className="flex flex-col gap-6">
      <Group icon={HardDrive} title="Limite storage">
        <SettingRow
          field="globalMaxFileSize"
          kind="bytes"
          icon={FileText}
          label="Max / fișier"
          description="Plafon pe orice fișier, pentru toți."
          current={settings.globalMaxFileSize}
        />
        <SettingRow
          field="defaultUserQuota"
          kind="bytes"
          icon={User}
          label="Cotă implicită / user"
          description="Total per user, dacă n-are limită proprie."
          current={settings.defaultUserQuota}
        />
        <SettingRow
          field="globalMaxTotal"
          kind="bytes"
          icon={Database}
          label="Total platformă"
          description="Suma fișierelor tuturor userilor."
          current={settings.globalMaxTotal}
        />
      </Group>

      <Group icon={Users} title="Conturi">
        <SettingRow
          field="maxAccounts"
          kind="count"
          icon={Users}
          label="Nr. maxim de conturi"
          description="Câte conturi pot exista (toate, inclusiv admini)."
          current={settings.maxAccounts}
        />
      </Group>
    </div>
  );
}
