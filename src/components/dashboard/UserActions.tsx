"use client";

import { useActionState } from "react";
import { LogOut, ShieldAlert, ShieldCheck, HardDrive } from "lucide-react";
import {
  blockUserAction,
  unblockUserAction,
  signOutUserAction,
  setUserLimitsAction,
  resetUserLimitsAction,
} from "@/app/dashboard/(panel)/users/actions";
import { isBlocked, isPermanentBlock, type UserActionState } from "@/lib/user-presence";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const fieldCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-white/10 focus:ring-1 focus:ring-indigo-400/40";
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";

const DURATION_OPTIONS = [
  { value: "1h", label: "1 oră" },
  { value: "24h", label: "1 zi" },
  { value: "72h", label: "3 zile" },
  { value: "168h", label: "7 zile" },
  { value: "720h", label: "30 zile" },
  { value: "permanent", label: "Permanent" },
];

// Prefill: show GB for ≥1GB values, otherwise MB, with the matching unit.
function splitUnit(bytes: number | null): { value: string; unit: "MB" | "GB" } {
  if (bytes == null) return { value: "", unit: "GB" };
  if (bytes >= GB) return { value: String(Math.round((bytes / GB) * 100) / 100), unit: "GB" };
  return { value: String(Math.round((bytes / MB) * 100) / 100), unit: "MB" };
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const initial: UserActionState = {};

export function UserActions({
  user,
  isSelf,
}: {
  user: {
    id: string;
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
  const file = splitUnit(user.max_file_size);
  const total = splitUnit(user.max_total_size);

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Block / Unblock ===== */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-zinc-100">
          <ShieldAlert className="h-5 w-5 text-red-400" />
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
            {blockState.error && (
              <p className="text-sm text-red-300">{blockState.error}</p>
            )}
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

      {/* ===== Force sign out ===== */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-zinc-100">
          <LogOut className="h-5 w-5 text-amber-400" />
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
          {signOutState.error && <p className="text-sm text-red-300">{signOutState.error}</p>}
          {signOutState.ok && <p className="text-sm text-emerald-300">{signOutState.ok}</p>}
        </form>
      </section>

      {/* ===== Storage limits ===== */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-zinc-100">
          <HardDrive className="h-5 w-5 text-indigo-400" />
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
          {limitsState.error && <p className="text-sm text-red-300">{limitsState.error}</p>}
          {limitsState.ok && <p className="text-sm text-emerald-300">{limitsState.ok}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={limitsPending}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60"
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
    </div>
  );
}
