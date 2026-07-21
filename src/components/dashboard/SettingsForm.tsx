"use client";

import { useActionState } from "react";
import { HardDrive } from "lucide-react";
import { saveSettingsAction, resetSettingsAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import { splitUnit } from "@/lib/bytes";
import type { SettingsState } from "@/lib/settings-state";
import type { GlobalSettings } from "@/server/admin/settings";

const initial: SettingsState = {};
const fieldCls =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";
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
  useToastState(state);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
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

        <div className="border-t border-zinc-800/70 pt-4">
          <label htmlFor="maxAccounts" className={labelCls}>Nr. maxim de conturi</label>
          <input
            id="maxAccounts"
            name="maxAccounts"
            type="text"
            inputMode="numeric"
            defaultValue={settings.maxAccounts ?? ""}
            placeholder="nelimitat"
            className={`${fieldCls} sm:max-w-xs`}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Câte conturi pot exista pe platformă (toate, inclusiv admini). Gol = nelimitat.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-60"
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
