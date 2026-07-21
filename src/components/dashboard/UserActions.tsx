"use client";

import { useActionState } from "react";
import { LogOut, ShieldAlert, ShieldCheck, HardDrive, UserCog, Crown, User } from "lucide-react";
import {
  blockUserAction,
  unblockUserAction,
  signOutUserAction,
  setUserLimitsAction,
  resetUserLimitsAction,
  setUserRoleAction,
} from "@/app/dashboard/(panel)/users/actions";
import { DeleteUser } from "@/components/dashboard/DeleteUser";
import { isBlocked, isPermanentBlock, type UserActionState } from "@/lib/user-presence";
import { useToastState } from "@/lib/useToastState";
import { splitUnit } from "@/lib/bytes";
import { formatDateTime as fmt } from "@/lib/format-date";

const fieldCls =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";

const DURATION_OPTIONS = [
  { value: "1h", label: "1 oră" },
  { value: "24h", label: "1 zi" },
  { value: "72h", label: "3 zile" },
  { value: "168h", label: "7 zile" },
  { value: "720h", label: "30 zile" },
  { value: "permanent", label: "Permanent" },
];

const initial: UserActionState = {};

export function UserActions({
  user,
  isSelf,
}: {
  user: {
    id: string;
    username: string;
    role: "user" | "admin";
    is_super_admin: boolean;
    blocked_until: string | null;
    blocked_reason: string | null;
    max_file_size: number | null;
    max_total_size: number | null;
  };
  isSelf: boolean;
}) {
  const blocked = isBlocked(user.blocked_until);
  const [blockState, blockAction, blockPending] = useActionState(blockUserAction, initial);
  const [limitsState, limitsAction, limitsPending] = useActionState(setUserLimitsAction, initial);
  const [signOutState, signOutAction, signOutPending] = useActionState(signOutUserAction, initial);
  const [roleState, roleAction, rolePending] = useActionState(setUserRoleAction, initial);
  useToastState(blockState);
  useToastState(limitsState);
  useToastState(signOutState);
  useToastState(roleState);
  const isAdmin = user.role === "admin";
  const file = splitUnit(user.max_file_size);
  const total = splitUnit(user.max_total_size);

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Block / Unblock ===== */}
      <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2.5 text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Acces cont</h3>
        </div>

        {blocked ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-200">
              {isPermanentBlock(user.blocked_until) ? (
                <strong>Blocat permanent</strong>
              ) : (
                <>
                  Blocat până la <strong>{fmt(user.blocked_until)}</strong>
                </>
              )}
              {user.blocked_reason && (
                <>
                  <br />
                  <span className="text-red-300/80">Motiv: {user.blocked_reason}</span>
                </>
              )}
            </p>
            <form action={unblockUserAction}>
              <input type="hidden" name="id" value={user.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/60 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-900/30"
              >
                <ShieldCheck className="h-4 w-4" /> Deblochează
              </button>
            </form>
          </div>
        ) : isSelf ? (
          <p className="text-sm text-zinc-500">Acesta e contul tău — nu te poți bloca singur.</p>
        ) : (
          <form action={blockAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={user.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="duration" className={labelCls}>Durată</label>
                <select id="duration" name="duration" defaultValue="24h" className={fieldCls}>
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reason" className={labelCls}>
                  Motiv <span className="text-zinc-500">(opțional)</span>
                </label>
                <input id="reason" name="reason" type="text" placeholder="ex: abuz" className={fieldCls} />
              </div>
            </div>
            <button
              type="submit"
              disabled={blockPending}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-red-900/60 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-950/40 disabled:opacity-60"
            >
              <ShieldAlert className="h-4 w-4" />
              {blockPending ? "Se blochează…" : "Blochează"}
            </button>
          </form>
        )}
      </section>

      {/* ===== Role ===== */}
      <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2.5 text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <UserCog className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Rol</h3>
        </div>

        {isSelf ? (
          <p className="text-sm text-zinc-500">
            Acesta e contul tău — nu-ți poți schimba propriul rol de aici.
          </p>
        ) : user.is_super_admin ? (
          <p className="flex items-center gap-2 text-sm text-amber-300/90">
            <Crown className="h-4 w-4 shrink-0" />
            Master admin — rolul e protejat și nu poate fi schimbat.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400">
              Rol curent:{" "}
              <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
                {isAdmin ? <Crown className="h-3.5 w-3.5 text-indigo-300" /> : <User className="h-3.5 w-3.5 text-zinc-400" />}
                {isAdmin ? "Administrator" : "Utilizator"}
              </span>
            </p>
            <form action={roleAction}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="role" value={isAdmin ? "user" : "admin"} />
              <button
                type="submit"
                disabled={rolePending}
                className={`inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2.5 text-sm transition disabled:opacity-60 ${
                  isAdmin
                    ? "border-zinc-800 text-zinc-300 hover:border-amber-900/60 hover:text-amber-200"
                    : "border-indigo-900/60 text-indigo-200 hover:bg-indigo-950/40"
                }`}
              >
                {isAdmin ? <User className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                {rolePending
                  ? "Se salvează…"
                  : isAdmin
                    ? "Retrogradează la utilizator"
                    : "Promovează la administrator"}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* ===== Force sign out ===== */}
      <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2.5 text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <LogOut className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Sesiuni</h3>
        </div>
        <p className="mb-3 text-sm text-zinc-400">
          Invalidează sesiunile active — userul va trebui să se relogheze.
        </p>
        <form action={signOutAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={user.id} />
          <button
            type="submit"
            disabled={signOutPending}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-amber-900/60 hover:text-amber-200 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" /> {signOutPending ? "Se invalidează…" : "Sign out forțat"}
          </button>
        </form>
      </section>

      {/* ===== Storage limits ===== */}
      <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2.5 text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <HardDrive className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Limite spațiu</h3>
        </div>
        <p className="mb-3 text-sm text-zinc-400">
          Lasă gol = nelimitat. Valori în GB.
        </p>
        <form action={limitsAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={user.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="maxFile" className={labelCls}>Max / fișier</label>
              <div className="flex gap-2">
                <input
                  id="maxFile"
                  name="maxFile"
                  type="text"
                  inputMode="decimal"
                  defaultValue={file.value}
                  placeholder="nelimitat"
                  className={fieldCls}
                />
                <select name="maxFileUnit" defaultValue={file.unit} className={`${fieldCls} w-24`}>
                  <option value="MB" className="bg-zinc-900">MB</option>
                  <option value="GB" className="bg-zinc-900">GB</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="maxTotal" className={labelCls}>Max total</label>
              <div className="flex gap-2">
                <input
                  id="maxTotal"
                  name="maxTotal"
                  type="text"
                  inputMode="decimal"
                  defaultValue={total.value}
                  placeholder="nelimitat"
                  className={fieldCls}
                />
                <select name="maxTotalUnit" defaultValue={total.unit} className={`${fieldCls} w-24`}>
                  <option value="MB" className="bg-zinc-900">MB</option>
                  <option value="GB" className="bg-zinc-900">GB</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={limitsPending}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-60"
            >
              {limitsPending ? "Se salvează…" : "Salvează limite"}
            </button>
            <button
              type="submit"
              formAction={resetUserLimitsAction}
              className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {/* ===== Danger zone ===== */}
      {/* Hidden on your own account: deleting yourself goes through /profil,
          where you re-authenticate first. */}
      {!isSelf && <DeleteUser id={user.id} username={user.username} />}
    </div>
  );
}
