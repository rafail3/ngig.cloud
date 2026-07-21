"use client";

import { useActionState, useRef, useState } from "react";
import { Eye, FileText, ServerCog, Wand2, Loader2 } from "lucide-react";
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

// Short label for the compact segmented control (the full label is spelled out
// in the active-mode description below).
const SHORT_LABEL: Record<OfficeServiceMode, string> = {
  auto: "Automat",
  legacy: "Simplu",
  onlyoffice: "OnlyOffice",
};

export function OfficeModeSettings({ status }: { status: OfficeStatus }) {
  const [state, formAction, pending] = useActionState(saveOfficeModeAction, initial);
  useToastState(state);
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<OfficeServiceMode>(status.mode);

  const active = OFFICE_SERVICE_MODES.find((m) => m.value === picked);

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-zinc-200">
        <FileText className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-semibold">Mod de funcționare</h3>
        {pending && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Se salvează…
          </span>
        )}
      </div>

      {/* Auto-saves on selection (a single click applies the mode) — no button. */}
      <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
        <div
          role="radiogroup"
          aria-label="Mod de funcționare"
          className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
        >
          {OFFICE_SERVICE_MODES.map((m) => {
            const Icon = MODE_ICON[m.value];
            const on = picked === m.value;
            return (
              <label
                key={m.value}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition ${
                  on
                    ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/25"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="officeMode"
                  value={m.value}
                  checked={on}
                  onChange={() => {
                    setPicked(m.value);
                    // Apply immediately.
                    formRef.current?.requestSubmit();
                  }}
                  className="sr-only"
                />
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{SHORT_LABEL[m.value]}</span>
              </label>
            );
          })}
        </div>

        {active && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-400">
            <span className="mt-1.5 inline-flex shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
              {active.tagline}
            </span>
            <span>{active.description}</span>
          </p>
        )}
      </form>
    </div>
  );
}
