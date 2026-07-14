"use client";

import { useActionState, useState } from "react";
import { UserCog, KeyRound, AtSign } from "lucide-react";
import {
  changeUsernameAction,
  changePasswordAction,
  changeEmailAction,
} from "@/app/(app)/profil/actions";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useToastState } from "@/lib/useToastState";
import type { AccountState } from "@/lib/account-state";

const initial: AccountState = {};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
// Slim fields (less tall, smaller text). Passed to PasswordInput too, so every
// field in these forms matches.
const inputCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-3.5 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40";
const btnCls =
  "rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60";
// Inputs stacked full-width inside the card — slim and long.
const rowCls = "flex flex-col gap-3";

export function AccountForms({
  currentUsername,
  currentEmail,
}: {
  currentUsername: string;
  currentEmail: string;
}) {
  const [uState, uAction, uPending] = useActionState(changeUsernameAction, initial);
  const [pState, pAction, pPending] = useActionState(changePasswordAction, initial);
  const [eState, eAction, ePending] = useActionState(changeEmailAction, initial);
  useToastState(uState);
  useToastState(pState);
  useToastState(eState);

  // Custom inline validation for the email field (no native browser bubble).
  // Starts empty — the current email is shown as a hint under the input.
  const [email, setEmail] = useState(eState.email ?? "");
  const emailTrimmed = email.trim();
  const emailInvalid = emailTrimmed !== "" && !EMAIL_RE.test(emailTrimmed);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Change username */}
      <section className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-zinc-100">
          <UserCog className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Schimbă username</h2>
        </div>
        <form noValidate action={uAction} className="flex flex-1 flex-col gap-3">
          <div className={rowCls}>
            <div>
              <label htmlFor="username" className={labelCls}>Username nou</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                defaultValue={uState.username}
                placeholder="username nou"
                autoComplete="username"
                className={inputCls}
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                Username-ul tău actual:{" "}
                <span className="text-zinc-300">{currentUsername}</span>
              </p>
            </div>
            <div>
              <label htmlFor="u-password" className={labelCls}>Parola curentă</label>
              <PasswordInput name="password" autoComplete="current-password" defaultValue={uState.password} className={inputCls} />
            </div>
          </div>
          <div className="mt-auto">
            <button type="submit" disabled={uPending} className={btnCls}>
              {uPending ? "Se schimbă…" : "Schimbă username"}
            </button>
          </div>
        </form>
      </section>

      {/* Change password */}
      <section className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-zinc-100">
          <KeyRound className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Schimbă parola</h2>
        </div>
        <form noValidate action={pAction} className="flex flex-1 flex-col gap-3">
          <div className={rowCls}>
            <div>
              <label htmlFor="oldPassword" className={labelCls}>Parola veche</label>
              <PasswordInput name="oldPassword" autoComplete="current-password" defaultValue={pState.oldPassword} className={inputCls} />
            </div>
            <div>
              <label htmlFor="newPassword" className={labelCls}>Parola nouă</label>
              <PasswordInput name="newPassword" autoComplete="new-password" defaultValue={pState.newPassword} className={inputCls} />
              <p className="mt-1 text-xs text-zinc-500">
                Minim 10 caractere, cu literă mare, mică, cifră și simbol.
              </p>
            </div>
          </div>
          <div className="mt-auto">
            <button type="submit" disabled={pPending} className={btnCls}>
              {pPending ? "Se schimbă…" : "Schimbă parola"}
            </button>
          </div>
        </form>
      </section>

      {/* Change email */}
      <section className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-zinc-100">
          <AtSign className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Schimbă email</h2>
        </div>
        <form noValidate action={eAction} className="flex flex-1 flex-col gap-3">
          <div className={rowCls}>
            <div>
              <label htmlFor="email" className={labelCls}>Email nou</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adresa-nouă@exemplu.com"
                autoComplete="email"
                className={inputCls}
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                Emailul tău activ:{" "}
                <span className="break-all text-zinc-300">{currentEmail}</span>
              </p>
              {emailInvalid && (
                <p className="mt-1 text-xs text-red-400">Adresă de email invalidă.</p>
              )}
            </div>
            <div>
              <label htmlFor="e-password" className={labelCls}>Parola curentă</label>
              <PasswordInput name="password" autoComplete="current-password" defaultValue={eState.password} className={inputCls} />
              <p className="mt-1.5 text-xs text-zinc-500">
                Se schimbă imediat; îți trimitem un link de activare pe noua adresă.
              </p>
            </div>
          </div>
          <div className="mt-auto">
            <button
              type="submit"
              disabled={ePending || emailInvalid || emailTrimmed === ""}
              className={btnCls}
            >
              {ePending ? "Se schimbă…" : "Schimbă emailul"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
