"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";
import { createInviteAction } from "@/app/dashboard/(panel)/invites/actions";
import type { GenerateState } from "@/lib/invite-status";

const initial: GenerateState = {};

const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const fieldCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-white/10 focus:ring-1 focus:ring-indigo-400/40";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Niciodată" },
  { value: "1h", label: "1 oră" },
  { value: "1d", label: "1 zi" },
  { value: "3d", label: "3 zile" },
  { value: "1w", label: "1 săptămână" },
  { value: "1mo", label: "1 lună" },
];

export function InviteGenerator() {
  const [state, formAction, pending] = useActionState(createInviteAction, initial);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.code) return;
    await navigator.clipboard.writeText(state.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        <Ticket className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Generează cod de invitație</h2>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="expiry" className={labelCls}>Expiră</label>
            <select id="expiry" name="expiry" defaultValue="never" className={fieldCls}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-900">
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="role" className={labelCls}>Rol</label>
            <select id="role" name="role" defaultValue="user" className={fieldCls}>
              <option value="user" className="bg-zinc-900">User</option>
              <option value="admin" className="bg-zinc-900">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>
              Email <span className="text-zinc-500">(opțional — leagă codul de un email)</span>
            </label>
            <input id="email" name="email" type="email" placeholder="nume@exemplu.com" className={fieldCls} />
          </div>

          <div>
            <label htmlFor="label" className={labelCls}>
              Notă <span className="text-zinc-500">(opțional)</span>
            </label>
            <input id="label" name="label" type="text" placeholder="ex: pentru Andrei" className={fieldCls} />
          </div>
        </div>

        {state.error && (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Se generează…" : "Generează cod"}
        </button>
      </form>

      {state.code && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-emerald-400/80">Cod nou</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tracking-wider text-emerald-200">
              {state.code}
            </p>
          </div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-800/60 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-900/40"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiat" : "Copiază"}
          </button>
        </div>
      )}
    </div>
  );
}
