"use client";

import { useActionState } from "react";
import { Link2 } from "lucide-react";
import { saveOfficeServerUrlAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import type { SettingsState } from "@/lib/settings-state";

const initial: SettingsState = {};

// The Document Server's address, as a setting rather than a deploy-time env var.
// The host announces itself on boot (/api/office/register), so this field is the
// manual override — and what you'd use to point the cloud at a different server.
export function OfficeServerUrl({ url }: { url: string }) {
  const [state, formAction, pending] = useActionState(saveOfficeServerUrlAction, initial);
  useToastState(state);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2 text-zinc-100">
        <Link2 className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Adresa serverului</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        Unde răspunde containerul OnlyOffice. Se aplică instant, fără redeploy. Serverul
        și-o anunță singur la pornire — completeaz-o aici doar dacă vrei să o schimbi manual.
      </p>

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          name="serverUrl"
          defaultValue={url}
          placeholder="https://ceva.trycloudflare.com"
          spellCheck={false}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 font-mono text-sm text-zinc-50 outline-none transition placeholder:font-sans placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Salvează"}
        </button>
      </form>
    </div>
  );
}
