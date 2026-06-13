"use client";

import { useActionState, useEffect, useState } from "react";
import { registerWithInvite } from "@/app/register/actions";
import type { RegisterState } from "@/lib/auth-state";
import { PasswordInput } from "./PasswordInput";

const initial: RegisterState = {};

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-white/10 focus:ring-1 focus:ring-indigo-400/40 sm:py-3";

type Check = { u: string; status: "checking" | "available" | "taken" };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerWithInvite, initial);
  const [username, setUsername] = useState(state.values?.username ?? "");
  const [check, setCheck] = useState<Check | null>(null);

  // Debounced real-time availability. State is only set inside the deferred
  // timeout callback (never synchronously in the effect body).
  useEffect(() => {
    const u = username.trim();
    if (!USERNAME_RE.test(u)) return;

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCheck({ u, status: "checking" });
      try {
        const res = await fetch(`/api/username-available?u=${encodeURIComponent(u)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setCheck({ u, status: data.available ? "available" : "taken" });
      } catch {
        if (!ctrl.signal.aborted) setCheck(null);
      }
    }, 400);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [username]);

  // Derive the username hint during render (no setState in effect).
  const u = username.trim();
  const fresh = check?.u === u ? check.status : null;
  let msg: { text: string; cls: string } | null = null;
  if (u === "") {
    msg = null;
  } else if (!USERNAME_RE.test(u)) {
    msg = { text: "3-30 caractere: litere, cifre, _", cls: "text-red-400" };
  } else if (fresh === "available") {
    msg = { text: "Disponibil", cls: "text-green-400" };
  } else if (fresh === "taken") {
    msg = { text: "Indisponibil", cls: "text-red-400" };
  } else {
    msg = { text: "Se verifică…", cls: "text-zinc-500" };
  }

  const blocked = u !== "" && (!USERNAME_RE.test(u) || fresh === "taken");

  return (
    <form action={formAction} className="flex flex-col gap-3.5 sm:gap-4">
      {state.error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="code" className={labelCls}>
          Cod de invitație
        </label>
        <input
          id="code"
          type="text"
          name="code"
          required
          defaultValue={state.values?.code}
          className={`${inputCls} font-mono`}
        />
      </div>

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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputCls}
        />
        {msg && <p className={`mt-1.5 text-xs ${msg.cls}`}>{msg.text}</p>}
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          defaultValue={state.values?.email}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>
          Parolă
        </label>
        <PasswordInput
          name="password"
          autoComplete="new-password"
          minLength={8}
          defaultValue={state.values?.password}
        />
        <p className="mt-1.5 text-xs text-zinc-600">Minim 8 caractere.</p>
      </div>

      <button
        type="submit"
        disabled={pending || blocked}
        className="mt-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-base font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
      >
        {pending ? "Se creează contul…" : "Creează cont"}
      </button>
    </form>
  );
}
