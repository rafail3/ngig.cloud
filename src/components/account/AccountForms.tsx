"use client";

import { useActionState } from "react";
import { UserCog, KeyRound } from "lucide-react";
import { changeUsernameAction, changePasswordAction } from "@/app/(app)/profil/actions";
import { PasswordInput } from "@/components/auth/PasswordInput";
import type { AccountState } from "@/lib/account-state";

const initial: AccountState = {};
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const inputCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40";
const btnCls =
  "self-start rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60";

function Msg({ state }: { state: AccountState }) {
  if (state.error) return <p className="text-sm text-red-300">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-300">{state.ok}</p>;
  return null;
}

export function AccountForms({ currentUsername }: { currentUsername: string }) {
  const [uState, uAction, uPending] = useActionState(changeUsernameAction, initial);
  const [pState, pAction, pPending] = useActionState(changePasswordAction, initial);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Change username */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-zinc-100">
          <UserCog className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Schimbă username</h2>
        </div>
        <form action={uAction} className="flex flex-col gap-3">
          <div>
            <label htmlFor="username" className={labelCls}>Username nou</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              defaultValue={uState.username ?? currentUsername}
              autoComplete="username"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="u-password" className={labelCls}>Parola curentă</label>
            <PasswordInput name="password" autoComplete="current-password" defaultValue={uState.password} />
          </div>
          <Msg state={uState} />
          <button type="submit" disabled={uPending} className={btnCls}>
            {uPending ? "Se salvează…" : "Salvează username"}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-zinc-100">
          <KeyRound className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Schimbă parola</h2>
        </div>
        <form action={pAction} className="flex flex-col gap-3">
          <div>
            <label htmlFor="oldPassword" className={labelCls}>Parola veche</label>
            <PasswordInput name="oldPassword" autoComplete="current-password" defaultValue={pState.oldPassword} />
          </div>
          <div>
            <label htmlFor="newPassword" className={labelCls}>Parola nouă</label>
            <PasswordInput name="newPassword" autoComplete="new-password" defaultValue={pState.newPassword} />
            <p className="mt-1 text-xs text-zinc-500">
              Minim 10 caractere, cu literă mare, mică, cifră și simbol.
            </p>
          </div>
          <Msg state={pState} />
          <button type="submit" disabled={pPending} className={btnCls}>
            {pPending ? "Se salvează…" : "Salvează parola"}
          </button>
        </form>
      </section>
    </div>
  );
}
