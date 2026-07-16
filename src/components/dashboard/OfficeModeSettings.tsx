"use client";

import { useActionState } from "react";
import { FileText } from "lucide-react";
import { saveOfficeModeAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import { OFFICE_SERVICE_MODES, type OfficeStatus } from "@/lib/office";
import type { SettingsState } from "@/lib/settings-state";

const initial: SettingsState = {};

export function OfficeModeSettings({ status }: { status: OfficeStatus }) {
  const [state, formAction, pending] = useActionState(saveOfficeModeAction, initial);
  useToastState(state);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2 text-zinc-100">
        <FileText className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Documente Office</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        Cum tratează platforma previzualizarea și editarea documentelor Word, Excel și
        PowerPoint.
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {OFFICE_SERVICE_MODES.map((m) => (
            <label
              key={m.value}
              className="group flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5 transition has-[:checked]:border-indigo-500/60 has-[:checked]:bg-indigo-500/5 hover:border-zinc-700"
            >
              <input
                type="radio"
                name="officeMode"
                value={m.value}
                defaultChecked={status.mode === m.value}
                className="peer sr-only"
              />
              {/* The inner dot is drawn with ::after — a pseudo-element of this
                  sibling span, which peer-checked CAN reach (a descendant of the
                  span could not). */}
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 transition after:h-1.5 after:w-1.5 after:rounded-full after:bg-white after:opacity-0 after:transition peer-checked:border-indigo-500 peer-checked:bg-indigo-500 peer-checked:after:opacity-100" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-100">{m.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
                  {m.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-60"
          >
            {pending ? "Se salvează…" : "Salvează mod"}
          </button>
        </div>
      </form>
    </div>
  );
}
