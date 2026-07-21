"use client";

import { useActionState, useEffect, useState } from "react";
import { Link2, Wand2, Pencil, TriangleAlert } from "lucide-react";
import {
  getOfficeServerInfoAction,
  saveOfficeServerUrlAction,
} from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import type { OfficeUrlMode } from "@/lib/office";
import type { SettingsState } from "@/lib/settings-state";

const initial: SettingsState = {};
// How often to re-read the address while the server owns it.
const LIVE_MS = 10_000;

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
    hint: "Serverul își anunță singur adresa (bun pentru un tunel care se schimbă la repornire).",
  },
  {
    value: "manual",
    label: "Manual",
    icon: Pencil,
    hint: "Se folosește doar adresa fixată aici; anunțurile automate sunt ignorate.",
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

  // In auto mode the address is written by the SERVER (it announces itself on
  // boot), so it can change while this page is open — showing the value this
  // page was rendered with would be a lie. Poll for the real one.
  const [live, setLive] = useState(url);
  useEffect(() => {
    if (!auto) return;
    const load = () =>
      void getOfficeServerInfoAction()
        .then((i) => setLive(i.url))
        .catch(() => {});
    load();
    const id = setInterval(load, LIVE_MS);
    return () => clearInterval(id);
  }, [auto]);

  // What the field shows: the live address when the server owns it, what you're
  // typing when you do.
  const shown = auto ? live : typed;

  // A plain-http address is the one setting the status panel can't warn you
  // about: our server may reach it fine and report "operational", while every
  // browser refuses to load it into an https page (mixed content). Only
  // localhost is exempt — that's the local dev setup.
  const insecure =
    /^http:\/\//i.test(shown) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(shown);

  const activeHint = MODES.find((m) => m.value === picked)?.hint ?? "";

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-zinc-200">
        <Link2 className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-semibold">Adresă server</h3>
      </div>

      <form action={formAction} className="flex flex-col gap-2.5">
        {/* Segmented Automat / Manual — compact track, active segment highlighted. */}
        <div
          role="radiogroup"
          aria-label="Sursa adresei serverului"
          className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = picked === m.value;
            return (
              <label
                key={m.value}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  on
                    ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/25"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="urlMode"
                  value={m.value}
                  checked={on}
                  onChange={() => {
                    // Switching to manual starts from the address in force right now.
                    if (m.value === "manual") setTyped(live);
                    setPicked(m.value);
                  }}
                  className="sr-only"
                />
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </label>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            name="serverUrl"
            value={shown}
            onChange={(e) => setTyped(e.target.value)}
            readOnly={auto}
            placeholder="https://ceva.trycloudflare.com"
            spellCheck={false}
            aria-label="Adresa serverului"
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-sm outline-none transition placeholder:font-sans ${
              auto
                ? "cursor-not-allowed border-zinc-800/60 bg-zinc-950/30 text-zinc-500 placeholder:text-zinc-600"
                : "border-zinc-800 bg-zinc-950/50 text-zinc-50 placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15"
            }`}
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {pending ? "…" : "Salvează"}
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          {auto && !shown ? "Serverul nu și-a anunțat încă adresa — treci pe Manual." : activeHint}
        </p>

        {insecure && (
          <p className="flex items-start gap-1.5 text-xs text-amber-400/90">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Adresă <span className="font-mono">http://</span> — merge doar în dev local; pe
              producție browserul o blochează (conținut mixt). Folosește{" "}
              <span className="font-mono">https://</span>.
            </span>
          </p>
        )}
      </form>
    </div>
  );
}
