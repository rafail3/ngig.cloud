"use client";

import { useActionState, useState } from "react";
import { dashboardLogin } from "@/app/dashboard/login/actions";
import type { LoginState } from "@/lib/auth-state";
import { PasswordInput } from "./PasswordInput";
import { Turnstile } from "./Turnstile";
import { Spinner } from "./Spinner";

const initial: LoginState = {};

const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const inputCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-4 py-2.5 text-base text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40 sm:py-3";

export function DashboardLoginForm() {
  const [state, formAction, pending] = useActionState(dashboardLogin, initial);
  const [botReady, setBotReady] = useState(false);
  const busy = pending || !botReady;

  return (
    <form noValidate action={formAction} className="flex flex-col gap-3.5 sm:gap-4">
      {state.error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="username" className={labelCls}>
          Username
        </label>
        <input
          id="username"
          type="text"
          name="username"
          required
          autoComplete="username"
          defaultValue={state.username}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>
          Parolă
        </label>
        <PasswordInput
          name="password"
          autoComplete="current-password"
          defaultValue={state.password}
        />
      </div>

      <Turnstile resetSignal={state} onStatus={setBotReady} />

      <button
        type="submit"
        disabled={busy}
        className="relative mt-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-base font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
      >
        {pending ? "Se autentifică…" : !botReady ? "Verificare de securitate…" : "Intră în dashboard"}
        {busy && <Spinner className="absolute right-4 top-1/2 -translate-y-1/2" />}
      </button>
    </form>
  );
}
