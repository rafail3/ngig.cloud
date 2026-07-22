"use client";

import { useActionState, useState } from "react";
import { Copy, Ticket } from "lucide-react";
import { toast } from "sonner";
import { createInviteAction, sendInviteCodeAction } from "@/app/dashboard/(panel)/invites/actions";
import { useToastState } from "@/lib/useToastState";
import type { GenerateState, SendCodeState } from "@/lib/invite-status";

const initial: GenerateState = {};
const sendInitial: SendCodeState = {};

const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const fieldCls =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Niciodată" },
  { value: "1h", label: "1 oră" },
  { value: "3h", label: "3 ore" },
  { value: "1d", label: "1 zi" },
  { value: "3d", label: "3 zile" },
  { value: "1w", label: "1 săptămână" },
  { value: "1mo", label: "1 lună" },
];

// The freshly generated code. Copying it is the end of the job, so the panel
// dismisses itself — until now it lingered until the next generate or a reload,
// leaving a live invite code sitting on screen.
//
// Mounted with `key={code}` by the parent: a new code is a new instance, which
// resets the dismissed state without an effect syncing props to state.
function NewCode({ code, email }: { code: string; email?: string }) {
  const [sendState, sendAction, sendPending] = useActionState(sendInviteCodeAction, sendInitial);
  const [dismissed, setDismissed] = useState(false);
  useToastState(sendState);

  if (dismissed) return null;

  async function copy() {
    await navigator.clipboard.writeText(code);
    // The panel vanishing is the feedback, so the toast carries the confirmation.
    toast.success("Cod copiat.");
    setDismissed(true);
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-emerald-400/80">Cod nou</p>
          <p className="mt-0.5 overflow-x-auto whitespace-nowrap font-mono text-sm font-semibold text-emerald-200 sm:text-base">
            {code}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-800/60 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-900/40"
        >
          <Copy className="h-4 w-4" />
          Copiază
        </button>
      </div>

      {email && (
        <form action={sendAction} className="flex flex-col gap-2 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4">
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="email" value={email} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-400">
              Trimite codul pe <span className="text-zinc-200">{email}</span>
            </p>
            <button
              type="submit"
              disabled={sendPending}
              className="shrink-0 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {sendPending ? "Se trimite…" : "Trimite codul pe email"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function InviteGenerator({
  prefillEmail,
  canCreateManager,
}: {
  prefillEmail?: string;
  // Minting manager accounts is super-admin only; managers see just "User".
  canCreateManager: boolean;
}) {
  const [state, formAction, pending] = useActionState(createInviteAction, initial);
  useToastState(state);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
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
              {canCreateManager && (
                <option value="admin" className="bg-zinc-900">Manager</option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>
              Email <span className="text-zinc-500">(opțional — leagă codul de un email)</span>
            </label>
            <input id="email" name="email" type="email" defaultValue={prefillEmail} placeholder="nume@exemplu.com" className={fieldCls} />
          </div>

          <div>
            <label htmlFor="label" className={labelCls}>
              Notă <span className="text-zinc-500">(opțional)</span>
            </label>
            <input id="label" name="label" type="text" placeholder="ex: pentru Andrei" className={fieldCls} />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Se generează…" : "Generează cod"}
        </button>
      </form>

      {state.code && (
        <NewCode key={state.code} code={state.code} email={state.email} />
      )}
    </div>
  );
}
