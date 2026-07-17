"use client";

import { useActionState, useState } from "react";
import { Link2, Wand2, Pencil, TriangleAlert } from "lucide-react";
import { saveOfficeServerUrlAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import type { OfficeUrlMode } from "@/lib/office";
import type { SettingsState } from "@/lib/settings-state";

const initial: SettingsState = {};

const MODES: {
  value: OfficeUrlMode;
  label: string;
  icon: typeof Wand2;
  hint: string;
}[] = [
  {
    value: "auto",
    label: "Automat",
    icon: Wand2,
    hint: "Serverul își anunță singur adresa la pornire. Potrivit când stă în spatele unui tunel care își schimbă adresa la fiecare repornire.",
  },
  {
    value: "manual",
    label: "Manual",
    icon: Pencil,
    hint: "Se folosește doar adresa scrisă aici. Anunțurile automate sunt ignorate, deci adresa fixată nu poate fi schimbată de altcineva.",
  },
];

// The Document Server's address, as a setting rather than a deploy-time env var.
export function OfficeServerUrl({ url, mode }: { url: string; mode: OfficeUrlMode }) {
  const [state, formAction, pending] = useActionState(saveOfficeServerUrlAction, initial);
  useToastState(state);
  // Local so the form re-shapes as you pick, before saving.
  const [picked, setPicked] = useState<OfficeUrlMode>(mode);
  const [typed, setTyped] = useState(url);
  const auto = picked === "auto";

  // A plain-http address is the one setting the status panel can't warn you
  // about: our server may reach it fine and report "operational", while every
  // browser refuses to load it into an https page (mixed content). Only
  // localhost is exempt — that's the local dev setup.
  const insecure = /^http:\/\//i.test(typed) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(typed);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2 text-zinc-100">
        <Link2 className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Adresa serverului</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        Unde răspunde containerul OnlyOffice. Se aplică instant, fără redeploy.
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <label
                key={m.value}
                className="group relative flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 transition hover:border-zinc-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-500/[0.07] has-[:checked]:shadow-[0_0_0_1px_rgb(99_102_241_/_0.5)]"
              >
                <input
                  type="radio"
                  name="urlMode"
                  value={m.value}
                  checked={picked === m.value}
                  onChange={() => setPicked(m.value)}
                  className="sr-only"
                />
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition group-has-[:checked]:border-indigo-500/40 group-has-[:checked]:bg-indigo-500/15 group-has-[:checked]:text-indigo-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100">
                    {m.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
                    {m.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            name="serverUrl"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            readOnly={auto}
            placeholder="https://ceva.trycloudflare.com"
            spellCheck={false}
            aria-label="Adresa serverului"
            className={`w-full rounded-xl border px-3.5 py-2.5 font-mono text-sm outline-none transition placeholder:font-sans ${
              auto
                ? "cursor-not-allowed border-zinc-800/60 bg-zinc-950/30 text-zinc-500 placeholder:text-zinc-600"
                : "border-zinc-800 bg-zinc-950/50 text-zinc-50 placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15"
            }`}
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Se salvează…" : "Salvează"}
          </button>
        </div>

        {insecure && (
          <p className="flex items-start gap-1.5 text-xs text-amber-400/90">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Adresă <span className="font-mono">http://</span> — merge doar în dev local.
              Pe producție browserul o blochează (conținut mixt) chiar dacă serverul pare
              pornit. Folosește <span className="font-mono">https://</span>.
            </span>
          </p>
        )}

        {auto && (
          <p className="text-xs text-zinc-500">
            Adresa de mai sus e ultima anunțată de server. Treci pe Manual ca s-o poți
            edita.
          </p>
        )}
      </form>
    </div>
  );
}
