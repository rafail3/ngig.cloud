"use client";

import { useActionState } from "react";
import { Check, Eye, FileText, ServerCog, Wand2 } from "lucide-react";
import { saveOfficeModeAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import {
  OFFICE_SERVICE_MODES,
  type OfficeServiceMode,
  type OfficeStatus,
} from "@/lib/office";
import type { SettingsState } from "@/lib/settings-state";

const initial: SettingsState = {};

const MODE_ICON: Record<OfficeServiceMode, typeof Wand2> = {
  auto: Wand2,
  legacy: Eye,
  onlyoffice: ServerCog,
};

export function OfficeModeSettings({ status }: { status: OfficeStatus }) {
  const [state, formAction, pending] = useActionState(saveOfficeModeAction, initial);
  useToastState(state);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2 text-zinc-100">
        <FileText className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Mod de funcționare</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        Cum tratează platforma previzualizarea și editarea când serverul e pornit sau oprit.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {OFFICE_SERVICE_MODES.map((m) => {
            const Icon = MODE_ICON[m.value];
            return (
              <label
                key={m.value}
                className="group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 transition hover:border-zinc-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-500/[0.07] has-[:checked]:shadow-[0_0_0_1px_rgb(99_102_241_/_0.5)]"
              >
                <input
                  type="radio"
                  name="officeMode"
                  value={m.value}
                  defaultChecked={status.mode === m.value}
                  className="peer sr-only"
                />

                {/* Selected check — a pseudo-element on this sibling span, which
                    peer-checked can reach (a descendant could not). */}
                <span className="pointer-events-none absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 opacity-0 transition peer-checked:opacity-100">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>

                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition peer-checked:border-indigo-500/40 peer-checked:bg-indigo-500/15 peer-checked:text-indigo-300">
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{m.label}</span>
                </span>
                <span className="inline-flex w-fit rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 transition peer-checked:border-indigo-500/30 peer-checked:bg-indigo-500/10 peer-checked:text-indigo-300">
                  {m.tagline}
                </span>
                <span className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  {m.description}
                </span>
              </label>
            );
          })}
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
