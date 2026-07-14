"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
const labelCls = "mb-1 block text-xs font-medium text-zinc-400";
const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";
const saveCls =
  "rounded-lg bg-indigo-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60";
const cancelCls =
  "rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200";

// One container card per tab; each setting is a divided row inside it.
export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-zinc-800/50 rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
      {children}
    </div>
  );
}

// Closed state = one calm line: setting name + its current value + "Schimbă".
// The edit form expands inline underneath only when asked for — the tab stays
// a short, scannable list instead of a wall of empty fields.
function EditableRow({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">{value}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm transition ${
            open
              ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
              : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
          }`}
        >
          Schimbă
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 sm:px-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function FormActions({
  pending,
  disabled,
  onCancel,
}: {
  pending: boolean;
  disabled?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <button type="submit" disabled={pending || disabled} className={saveCls}>
        {pending ? "Se salvează…" : "Salvează"}
      </button>
      <button type="button" onClick={onCancel} className={cancelCls}>
        Anulează
      </button>
    </div>
  );
}

export function UsernameForm({ currentUsername }: { currentUsername: string }) {
  const [state, action, pending] = useActionState(changeUsernameAction, initial);
  const [open, setOpen] = useState(false);
  useToastState(state);

  return (
    <EditableRow
      label="Username"
      value={currentUsername}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <form noValidate action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="username" className={labelCls}>Username nou</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              defaultValue={state.username}
              placeholder="username nou"
              autoComplete="username"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="u-password" className={labelCls}>Parola curentă</label>
            <PasswordInput name="password" autoComplete="current-password" defaultValue={state.password} className={inputCls} />
          </div>
        </div>
        <FormActions pending={pending} onCancel={() => setOpen(false)} />
      </form>
    </EditableRow>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  const [open, setOpen] = useState(false);
  useToastState(state);

  return (
    <EditableRow
      label="Parolă"
      value={<span className="tracking-widest">••••••••••</span>}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <form noValidate action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="oldPassword" className={labelCls}>Parola veche</label>
            <PasswordInput name="oldPassword" autoComplete="current-password" defaultValue={state.oldPassword} className={inputCls} />
          </div>
          <div>
            <label htmlFor="newPassword" className={labelCls}>Parola nouă</label>
            <PasswordInput name="newPassword" autoComplete="new-password" defaultValue={state.newPassword} className={inputCls} />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Minim 10 caractere, cu literă mare, mică, cifră și simbol.
        </p>
        <FormActions pending={pending} onCancel={() => setOpen(false)} />
      </form>
    </EditableRow>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState(changeEmailAction, initial);
  const [open, setOpen] = useState(false);
  useToastState(state);

  // Custom inline validation for the email field (no native browser bubble).
  const [email, setEmail] = useState(state.email ?? "");
  const emailTrimmed = email.trim();
  const emailInvalid = emailTrimmed !== "" && !EMAIL_RE.test(emailTrimmed);

  return (
    <EditableRow
      label="Email"
      value={currentEmail}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <form noValidate action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
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
            {emailInvalid && (
              <p className="mt-1 text-xs text-red-400">Adresă de email invalidă.</p>
            )}
          </div>
          <div>
            <label htmlFor="e-password" className={labelCls}>Parola curentă</label>
            <PasswordInput name="password" autoComplete="current-password" defaultValue={state.password} className={inputCls} />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Se schimbă imediat; îți trimitem un link de activare pe noua adresă.
        </p>
        <FormActions
          pending={pending}
          disabled={emailInvalid || emailTrimmed === ""}
          onCancel={() => setOpen(false)}
        />
      </form>
    </EditableRow>
  );
}
