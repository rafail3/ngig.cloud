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
        <div className="flex flex-col gap-2.5">
          {OFFICE_SERVICE_MODES.map((m) => {
            const Icon = MODE_ICON[m.value];
            return (
              <label
                key={m.value}
                className="group relative flex cursor-pointer items-center gap-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 pr-10 transition hover:border-zinc-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-500/[0.07] has-[:checked]:shadow-[0_0_0_1px_rgb(99_102_241_/_0.5)] sm:p-3.5 sm:pr-11"
              >
                <input
                  type="radio"
                  name="officeMode"
                  value={m.value}
                  defaultChecked={status.mode === m.value}
                  className="sr-only"
                />

                {/* State styling uses group-has-[:checked] (not peer-checked) so
                    it reaches nested elements like the tag, not only siblings. */}
                <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-500 opacity-0 transition group-has-[:checked]:opacity-100">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition group-has-[:checked]:border-indigo-500/40 group-has-[:checked]:bg-indigo-500/15 group-has-[:checked]:text-indigo-300">
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{m.label}</span>
                    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 transition group-has-[:checked]:border-indigo-500/30 group-has-[:checked]:bg-indigo-500/10 group-has-[:checked]:text-indigo-300">
                      {m.tagline}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
                    {m.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Se salvează…" : "Salvează mod"}
          </button>
        </div>
      </form>
    </div>
  );
}
