"use client";

import { useActionState } from "react";
import { HardDrive } from "lucide-react";
import { saveSettingsAction, resetSettingsAction } from "@/app/dashboard/(panel)/settings/actions";
import { splitUnit } from "@/lib/bytes";
import type { SettingsState } from "@/lib/settings-state";
import type { GlobalSettings } from "@/server/admin/settings";

const initial: SettingsState = {};
const fieldCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40";
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";

function Field({
  name,
  label,
  hint,
  bytes,
}: {
  name: string;
  label: string;
  hint: string;
  bytes: number | null;
}) {
  const { value, unit } = splitUnit(bytes);
  return (
    <div>
      <label htmlFor={name} className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <input
          id={name}
          name={name}
          type="text"
          inputMode="decimal"
          defaultValue={value}
          placeholder="nelimitat"
          className={fieldCls}
        />
        <select name={`${name}Unit`} defaultValue={unit} className={`${fieldCls} w-24`}>
          <option value="MB" className="bg-zinc-900">MB</option>
          <option value="GB" className="bg-zinc-900">GB</option>
        </select>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: GlobalSettings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initial);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        <HardDrive className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Limite storage (globale)</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">Lasă gol = nelimitat.</p>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            name="globalMaxFileSize"
            label="Max / fișier"
            hint="Plafon pe orice fișier, pentru toți."
            bytes={settings.globalMaxFileSize}
          />
          <Field
            name="defaultUserQuota"
            label="Cotă implicită / user"
            hint="Total per user, dacă n-are limită proprie."
            bytes={settings.defaultUserQuota}
          />
          <Field
            name="globalMaxTotal"
            label="Total platformă"
            hint="Suma fișierelor tuturor userilor."
            bytes={settings.globalMaxTotal}
          />
        </div>

        {state.error && <p className="text-sm text-red-300">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-300">{state.ok}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60"
          >
            {pending ? "Se salvează…" : "Salvează setări"}
          </button>
          <button
            type="submit"
            formAction={resetSettingsAction}
            className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
