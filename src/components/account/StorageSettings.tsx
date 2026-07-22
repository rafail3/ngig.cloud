"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, HardDrive, BellRing } from "lucide-react";
import { setSelfMaxTotalAction, setStorageAlertAction } from "@/app/(app)/profil/actions";
import { useToastState } from "@/lib/useToastState";
import { formatBytes } from "@/lib/format";
import type { MyStorageSettings } from "@/server/account/profile";
import type { AccountState } from "@/lib/account-state";

const initial: AccountState = {};

const labelCls = "mb-1 block text-xs font-medium text-zinc-400";
const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";
const saveCls =
  "rounded-lg bg-indigo-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60";

// The saved value lives in a small chip next to the input — never inside it.
function CurrentChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 text-xs text-zinc-400">
      {children}
    </span>
  );
}

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

// Profile → storage preferences: an own TOTAL storage cap (only when no admin
// quota applies) and a usage alert threshold (percent of the effective quota
// or a fixed MB/GB value).
//
// The actions are dispatched MANUALLY (controlled inputs + startTransition),
// not via <form action>: React 19's automatic form reset after an action races
// with the AnimatePresence unmount and crashes ("fiber.reset is not a
// function"). Manual dispatch sidesteps that machinery entirely — and the
// inputs stay blank by design, with the saved value in a chip beside them.
export function StorageSettings({ settings }: { settings: MyStorageSettings }) {
  const [capState, capDispatch, capPending] = useActionState(setSelfMaxTotalAction, initial);
  const [alertState, alertDispatch, alertPending] = useActionState(setStorageAlertAction, initial);
  useToastState(capState);
  useToastState(alertState);
  const [, startTransition] = useTransition();

  const [capOpen, setCapOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [capValue, setCapValue] = useState("");
  const [capUnit, setCapUnit] = useState("GB");
  const [alertValue, setAlertValue] = useState("");
  const [alertUnit, setAlertUnit] = useState("GB");

  const alert = settings.alert;
  const hasQuota = settings.effectiveQuota != null;
  const [mode, setMode] = useState<"percent" | "absolute">(
    alert?.mode ?? (hasQuota ? "percent" : "absolute"),
  );

  useEffect(() => {
    if (capState.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCapOpen(false);
      setCapValue("");
    }
  }, [capState.ok]);
  useEffect(() => {
    if (alertState.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlertOpen(false);
      setAlertValue("");
    }
  }, [alertState.ok]);

  function submitCap(reset: boolean) {
    const fd = new FormData();
    fd.set("reset", String(reset));
    fd.set("value", capValue);
    fd.set("unit", capUnit);
    startTransition(() => capDispatch(fd));
  }

  function submitAlert(enabled: boolean) {
    const fd = new FormData();
    fd.set("enabled", String(enabled));
    fd.set("mode", mode);
    fd.set("value", alertValue);
    fd.set("unit", alertUnit);
    startTransition(() => alertDispatch(fd));
  }

  const alertSummary =
    alert == null
      ? "Dezactivată"
      : alert.mode === "percent"
        ? `La ${alert.value}% din cota de ${formatBytes(settings.effectiveQuota ?? 0)}`
        : `La ${formatBytes(alert.value)} stocați`;

  return (
    <div className="divide-y divide-zinc-800/50 rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
      {/* ── Own total cap ── */}
      {settings.adminQuota != null ? (
        <section className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
          <span className="mt-0.5 shrink-0 text-zinc-500">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Cota mea de stocare</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Cota totală e stabilită de administrator:{" "}
              <span className="font-medium text-zinc-300">{formatBytes(settings.adminQuota)}</span>{" "}
              — nu poate fi modificată de aici.
            </p>
          </div>
        </section>
      ) : (
        <Row
          label="Plafonul meu de stocare"
          value={
            settings.selfMaxTotal != null
              ? `Max ${formatBytes(settings.selfMaxTotal)} în total — setat de tine`
              : "Nelimitat — îți poți seta un plafon total propriu"
          }
          open={capOpen}
          onToggle={() => setCapOpen((v) => !v)}
        >
          <div className="flex flex-col gap-3">
            <p className="flex items-start gap-2 text-xs text-zinc-500">
              <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Buget personal: upload-urile care ar depăși plafonul total sunt refuzate.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-40">
                <label htmlFor="selfMaxTotal" className={labelCls}>Plafon total</label>
                <input
                  id="selfMaxTotal"
                  type="text"
                  inputMode="decimal"
                  value={capValue}
                  onChange={(e) => setCapValue(e.target.value)}
                  placeholder="ex: 2"
                  className={inputCls}
                />
              </div>
              <UnitPicker value={capUnit} onChange={setCapUnit} />
              <CurrentChip>
                Actual:{" "}
                <span className="ml-1 font-medium text-zinc-200">
                  {settings.selfMaxTotal != null ? formatBytes(settings.selfMaxTotal) : "nelimitat"}
                </span>
              </CurrentChip>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => submitCap(false)} disabled={capPending} className={saveCls}>
                {capPending ? "Se salvează…" : "Salvează"}
              </button>
              {settings.selfMaxTotal != null && (
                <button
                  type="button"
                  onClick={() => submitCap(true)}
                  disabled={capPending}
                  className="rounded-lg border border-zinc-800 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-red-900/60 hover:text-red-200"
                >
                  Resetează
                </button>
              )}
            </div>
          </div>
        </Row>
      )}

      {/* ── Storage alert ── */}
      <Row
        label="Alertă de spațiu"
        value={alertSummary}
        open={alertOpen}
        onToggle={() => setAlertOpen((v) => !v)}
      >
        <div className="flex flex-col gap-3">
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
            <button
              type="button"
              role="radio"
              aria-checked={mode === "percent"}
              disabled={!hasQuota}
              onClick={() => setMode("percent")}
              title={hasQuota ? undefined : "Necesită o cotă (a adminului sau plafonul tău propriu)."}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "percent" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              % din cotă
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "absolute"}
              onClick={() => setMode("absolute")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                mode === "absolute" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Valoare fixă
            </button>
          </div>
          {!hasQuota && (
            <p className="text-xs text-zinc-600">
              Pragul procentual devine disponibil când există o cotă — a adminului sau plafonul tău propriu.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <label htmlFor="alertValue" className={labelCls}>
                {mode === "percent" ? "Prag (%)" : "Prag"}
              </label>
              <input
                id="alertValue"
                type="text"
                inputMode="decimal"
                value={alertValue}
                onChange={(e) => setAlertValue(e.target.value)}
                placeholder={mode === "percent" ? "ex: 80" : "ex: 4"}
                className={inputCls}
              />
            </div>
            {mode === "absolute" && <UnitPicker value={alertUnit} onChange={setAlertUnit} />}
            <CurrentChip>
              Actual:{" "}
              <span className="ml-1 font-medium text-zinc-200">
                {alert == null
                  ? "dezactivată"
                  : alert.mode === "percent"
                    ? `${alert.value}%`
                    : formatBytes(alert.value)}
              </span>
            </CurrentChip>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => submitAlert(true)} disabled={alertPending} className={saveCls}>
              {alertPending ? "Se salvează…" : "Salvează alerta"}
            </button>
            {alert != null && (
              <button
                type="button"
                onClick={() => submitAlert(false)}
                disabled={alertPending}
                className="rounded-lg border border-zinc-800 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-red-900/60 hover:text-red-200"
              >
                Dezactivează
              </button>
            )}
          </div>
        </div>
      </Row>
    </div>
  );
}
