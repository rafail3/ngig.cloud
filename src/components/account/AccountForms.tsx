"use client";

import { useActionState, useState } from "react";
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
// Quiet fields that sharpen on focus — same voice as the drive's search bar.
const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3.5 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";
const btnCls =
  "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60";

// Settings-page grammar: one container card per tab, one row per setting.
// Title + explanation live in the left column, the form in the right one —
// the layout does the talking, no icon chips needed.
export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-zinc-800/50 rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
      {children}
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-4 p-4 sm:p-6 md:grid-cols-[220px_1fr]">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      </div>
      <div className="min-w-0 md:max-w-md">{children}</div>
    </section>
  );
}

export function UsernameForm({ currentUsername }: { currentUsername: string }) {
  const [state, action, pending] = useActionState(changeUsernameAction, initial);
  useToastState(state);

  return (
    <SettingsRow
      title="Username"
      description="Numele cu care te conectezi și apari în cloud."
    >
      <form noValidate action={action} className="flex flex-col gap-3">
        <div>
          <label htmlFor="username" className={labelCls}>Username nou</label>
          <input
            id="username"
            name="username"
            type="text"
            required
            defaultValue={state.username}
            placeholder={currentUsername}
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
          <PasswordInput name="password" autoComplete="current-password" defaultValue={state.password} className={inputCls} />
        </div>
        <div className="pt-1">
          <button type="submit" disabled={pending} className={btnCls}>
            {pending ? "Se schimbă…" : "Schimbă username"}
          </button>
        </div>
      </form>
    </SettingsRow>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  useToastState(state);

  return (
    <SettingsRow
      title="Parolă"
      description="Schimb-o periodic și nu o refolosi pe alte site-uri."
    >
      <form noValidate action={action} className="flex flex-col gap-3">
        <div>
          <label htmlFor="oldPassword" className={labelCls}>Parola veche</label>
          <PasswordInput name="oldPassword" autoComplete="current-password" defaultValue={state.oldPassword} className={inputCls} />
        </div>
        <div>
          <label htmlFor="newPassword" className={labelCls}>Parola nouă</label>
          <PasswordInput name="newPassword" autoComplete="new-password" defaultValue={state.newPassword} className={inputCls} />
          <p className="mt-1 text-xs text-zinc-500">
            Minim 10 caractere, cu literă mare, mică, cifră și simbol.
          </p>
        </div>
        <div className="pt-1">
          <button type="submit" disabled={pending} className={btnCls}>
            {pending ? "Se schimbă…" : "Schimbă parola"}
          </button>
        </div>
      </form>
    </SettingsRow>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState(changeEmailAction, initial);
  useToastState(state);

  // Custom inline validation for the email field (no native browser bubble).
  // Starts empty — the current email is shown as a hint under the input.
  const [email, setEmail] = useState(state.email ?? "");
  const emailTrimmed = email.trim();
  const emailInvalid = emailTrimmed !== "" && !EMAIL_RE.test(emailTrimmed);

  return (
    <SettingsRow
      title="Email"
      description="Adresa pe care primești notificările și linkurile de cont. Se schimbă imediat; primești un link de activare pe noua adresă."
    >
      <form noValidate action={action} className="flex flex-col gap-3">
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
          <PasswordInput name="password" autoComplete="current-password" defaultValue={state.password} className={inputCls} />
        </div>
        <div className="pt-1">
          <button
            type="submit"
            disabled={pending || emailInvalid || emailTrimmed === ""}
            className={btnCls}
          >
            {pending ? "Se schimbă…" : "Schimbă emailul"}
          </button>
        </div>
      </form>
    </SettingsRow>
  );
}
