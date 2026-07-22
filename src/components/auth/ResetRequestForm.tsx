"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { requestResetAction } from "@/app/reset/actions";
import type { ResetRequestState } from "@/lib/email-state";
import { Turnstile, useQueuedSubmit } from "./Turnstile";
import { Spinner } from "./Spinner";

const initial: ResetRequestState = {};
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const inputCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-4 py-2.5 text-base text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40 sm:py-3";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initial);
  const [botReady, setBotReady] = useState(false);
  const { formRef, onSubmit, queued } = useQueuedSubmit(botReady);
  const busy = pending || queued;
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-8 text-center">
        <MailCheck className="h-10 w-10 text-emerald-400" />
        <p className="text-sm text-emerald-200">
          Dacă există un cont cu acest email, ți-am trimis un link de resetare.
          Verifică-ți inbox-ul — și folderul <strong>Spam</strong>, în caz că ajunge acolo.
        </p>
      </div>
    );
  }

  return (
    <form noValidate ref={formRef} onSubmit={onSubmit} action={formAction} className="flex flex-col gap-3.5 sm:gap-4">
      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className={inputCls}
        />
      </div>

      <Turnstile resetSignal={state} onStatus={setBotReady} />

      <button
        type="submit"
        disabled={busy}
        className="relative mt-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-4 py-2.5 text-base font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
      >
        {pending || queued ? "Se trimite…" : "Trimite link de resetare"}
        {busy && <Spinner className="absolute right-4 top-1/2 -translate-y-1/2" />}
      </button>
    </form>
  );
}
