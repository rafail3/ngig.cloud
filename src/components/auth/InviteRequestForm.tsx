"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { requestInviteAction } from "@/app/cere-invitatie/actions";
import type { InviteRequestState } from "@/lib/email-state";
import { Turnstile, useQueuedSubmit } from "./Turnstile";
import { Spinner } from "./Spinner";

const initial: InviteRequestState = {};
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const inputCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-4 py-2.5 text-base text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40 sm:py-3";

export function InviteRequestForm() {
  const [state, formAction, pending] = useActionState(requestInviteAction, initial);
  const [botReady, setBotReady] = useState(false);
  const { formRef, onSubmit, queued } = useQueuedSubmit(botReady);
  const busy = pending || queued;
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        <p className="text-sm text-emerald-200">
          Cererea a fost trimisă. Te contactăm pe email dacă e aprobată.
        </p>
      </div>
    );
  }

  return (
    <form noValidate ref={formRef} onSubmit={onSubmit} action={formAction} className="flex flex-col gap-3.5 sm:gap-4">
      <div>
        <label htmlFor="name" className={labelCls}>Nume</label>
        <input id="name" name="name" type="text" required defaultValue={state.values?.name} className={inputCls} />
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input id="email" name="email" type="email" required defaultValue={state.values?.email} autoComplete="email" className={inputCls} />
      </div>

      <div>
        <label htmlFor="message" className={labelCls}>
          Mesaj <span className="text-zinc-500">(opțional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          defaultValue={state.values?.message}
          placeholder="Spune-ne de ce vrei acces…"
          className={`${inputCls} resize-y`}
        />
      </div>

      <Turnstile resetSignal={state} onStatus={setBotReady} />

      <button
        type="submit"
        disabled={busy}
        className="relative mt-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-4 py-2.5 text-base font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
      >
        {pending || queued ? "Se trimite…" : "Trimite cererea"}
        {busy && <Spinner className="absolute right-4 top-1/2 -translate-y-1/2" />}
      </button>
    </form>
  );
}
