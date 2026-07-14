"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/app/reset/update/actions";
import type { ResetUpdateState } from "@/lib/email-state";
import { useToastState } from "@/lib/useToastState";
import { PasswordInput } from "./PasswordInput";

const initial: ResetUpdateState = {};
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";

export function ResetUpdateForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initial);
  useToastState(state);

  return (
    <form noValidate action={formAction} className="flex flex-col gap-3.5 sm:gap-4">
      <div>
        <label htmlFor="password" className={labelCls}>Parola nouă</label>
        <PasswordInput name="password" autoComplete="new-password" />
        <p className="mt-1.5 text-xs text-zinc-500">
          Minim 10 caractere, cu literă mare, mică, cifră și simbol.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className={labelCls}>Confirmă parola</label>
        <PasswordInput name="confirm" autoComplete="new-password" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-4 py-2.5 text-base font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
      >
        {pending ? "Se salvează…" : "Setează parola nouă"}
      </button>
    </form>
  );
}
