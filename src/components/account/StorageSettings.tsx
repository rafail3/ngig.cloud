"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, HardDrive, BellRing } from "lucide-react";
import { setSelfMaxFileAction, setStorageAlertAction } from "@/app/(app)/profil/actions";
import { useToastState } from "@/lib/useToastState";
import { formatBytes } from "@/lib/format";
import { splitUnit } from "@/lib/bytes";
import type { MyStorageSettings } from "@/server/account/profile";
import type { AccountState } from "@/lib/account-state";

const initial: AccountState = {};

const labelCls = "mb-1 block text-xs font-medium text-zinc-400";
const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";
const saveCls =
  "rounded-lg bg-indigo-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60";

// One expandable row, mirroring the AccountForms pattern (name + value +
// toggle button, form slides open underneath).
function Row({
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
          {open ? "Închide" : "Schimbă"}
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

function UnitPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (u: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Unitate" className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
      {["MB", "GB"].map((u) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={value === u}
          onClick={() => onChange(u)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === u ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

// Profile → storage preferences: an own per-file cap (only when no admin limit
// applies) and a total-usage alert threshold (percent of quota or absolute).
export function StorageSettings({ settings }: { settings: MyStorageSettings }) {
  const [limitState, limitAction, limitPending] = useActionState(setSelfMaxFileAction, initial);
  const [alertState, alertAction, alertPending] = useActionState(setStorageAlertAction, initial);
  useToastState(limitState);
  useToastState(alertState);

  const [limitOpen, setLimitOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (limitState.ok) setLimitOpen(false);
  }, [limitState.ok]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alertState.ok) setAlertOpen(false);
  }, [alertState.ok]);

  const self = splitUnit(settings.selfMaxFile);
  const [unit, setUnit] = useState<string>(self.unit);

  const hasQuota = settings.quota != null;
  const alert = settings.alert;
  const [mode, setMode] = useState<"percent" | "absolute">(
    alert?.mode ?? (hasQuota ? "percent" : "absolute"),
  );

  const alertValue =
    alert == null
      ? "Dezactivată"
      : alert.mode === "percent"
        ? `La ${alert.value}% din cota de ${formatBytes(settings.quota ?? 0)}`
        : `La ${formatBytes(alert.value)} stocați`;

  return (
    <div className="divide-y divide-zinc-800/50 rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
      {/* ── Own per-file cap ── */}
      {settings.adminMaxFile != null ? (
        <section className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
          <span className="mt-0.5 shrink-0 text-zinc-500">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Limită de upload</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Limita pe fișier e stabilită de administrator:{" "}
              <span className="font-medium text-zinc-300">{formatBytes(settings.adminMaxFile)}</span>{" "}
              — nu poate fi modificată de aici.
            </p>
          </div>
        </section>
      ) : (
        <Row
          label="Limita mea de upload"
          value={
            settings.selfMaxFile != null
              ? `Max ${formatBytes(settings.selfMaxFile)} / fișier — setată de tine`
              : "Nelimitat — îți poți seta un plafon propriu"
          }
          open={limitOpen}
          onToggle={() => setLimitOpen((v) => !v)}
        >
          <form action={limitAction} className="flex flex-col gap-3">
            <p className="flex items-start gap-2 text-xs text-zinc-500">
              <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Protecție proprie: upload-urile peste plafon sunt refuzate. Gol = fără plafon.
            </p>
            <div className="flex items-end gap-2">
              <div className="w-40">
                <label htmlFor="selfMax" className={labelCls}>Max / fișier</label>
                <input
                  id="selfMax"
                  name="value"
                  type="text"
                  inputMode="decimal"
                  defaultValue={self.value}
                  placeholder="nelimitat"
                  className={inputCls}
                />
              </div>
              <input type="hidden" name="unit" value={unit} />
              <UnitPicker value={unit} onChange={setUnit} />
            </div>
            <div>
              <button type="submit" disabled={limitPending} className={saveCls}>
                {limitPending ? "Se salvează…" : "Salvează"}
              </button>
            </div>
          </form>
        </Row>
      )}

      {/* ── Storage alert ── */}
      <Row
        label="Alertă de spațiu"
        value={alertValue}
        open={alertOpen}
        onToggle={() => setAlertOpen((v) => !v)}
      >
        <form action={alertAction} className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-xs text-zinc-500">
            <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Primești notificare + email când stocarea ta depășește pragul. Se rearmează când
            cobori sub el.
          </p>

          <div
            role="radiogroup"
            aria-label="Tip prag"
            className="flex w-fit gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
          >
            {hasQuota && (
              <button
                type="button"
                role="radio"
                aria-checked={mode === "percent"}
                onClick={() => setMode("percent")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  mode === "percent" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                % din cotă
              </button>
            )}
            <button
              type="button"
              role="radio"
              aria-checked={mode === "absolute"}
              onClick={() => setMode("absolute")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                mode === "absolute" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Valoare fixă (GB)
            </button>
          </div>

          <div className="flex items-end gap-2">
            <div className="w-40">
              <label htmlFor="alertValue" className={labelCls}>
                {mode === "percent" ? "Prag (%)" : "Prag (GB)"}
              </label>
              <input
                id="alertValue"
                name="value"
                type="text"
                inputMode="decimal"
                defaultValue={
                  alert == null
                    ? ""
                    : alert.mode === "percent"
                      ? String(alert.value)
                      : String(Math.round((alert.value / 1024 ** 3) * 100) / 100)
                }
                placeholder={mode === "percent" ? "ex: 80" : "ex: 4"}
                className={inputCls}
              />
            </div>
          </div>

          <input type="hidden" name="mode" value={mode} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="enabled" value="true" disabled={alertPending} className={saveCls}>
              {alertPending ? "Se salvează…" : "Salvează alerta"}
            </button>
            {alert != null && (
              <button
                type="submit"
                name="enabled"
                value="false"
                disabled={alertPending}
                className="rounded-lg border border-zinc-800 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-red-900/60 hover:text-red-200"
              >
                Dezactivează
              </button>
            )}
          </div>
        </form>
      </Row>
    </div>
  );
}
