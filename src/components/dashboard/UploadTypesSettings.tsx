"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileCheck2 } from "lucide-react";
import { saveUploadTypesAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import { UPLOAD_CATEGORIES, type UploadTypesConfig } from "@/lib/upload-types";
import type { SettingsState } from "@/lib/settings-state";
import type { FileCategory } from "@/lib/file-type";

const initial: SettingsState = {};

const fieldCls =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";

// Same compact whole-row switch as the notification settings.
function ToggleRow({
  on,
  onFlip,
  children,
}: {
  on: boolean;
  onFlip: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onFlip}
      className="flex w-fit items-center gap-3 text-left"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          on ? "bg-indigo-600" : "bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      {children}
    </button>
  );
}

// Super-admin card: which file types the platform accepts on upload.
// cfg = null means unrestricted (the default).
export function UploadTypesSettings({ cfg }: { cfg: UploadTypesConfig }) {
  const [state, action, pending] = useActionState(saveUploadTypesAction, initial);
  useToastState(state);

  const [open, setOpen] = useState(false);
  const [restricted, setRestricted] = useState(cfg !== null);
  const [cats, setCats] = useState<Set<FileCategory>>(
    () => new Set(cfg?.categories ?? UPLOAD_CATEGORIES.map((c) => c.key)),
  );
  const [allowExt, setAllowExt] = useState((cfg?.allowExt ?? []).join(", "));
  const [blockExt, setBlockExt] = useState((cfg?.blockExt ?? []).join(", "));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  function cancel() {
    setRestricted(cfg !== null);
    setCats(new Set(cfg?.categories ?? UPLOAD_CATEGORIES.map((c) => c.key)));
    setAllowExt((cfg?.allowExt ?? []).join(", "));
    setBlockExt((cfg?.blockExt ?? []).join(", "));
    setOpen(false);
  }

  const summary =
    cfg === null ? (
      <span className="text-zinc-400">
        <span className="font-semibold text-emerald-300">Toate tipurile permise</span>
      </span>
    ) : (
      <span className="text-zinc-400">
        Restricționat ·{" "}
        <span className="font-semibold text-indigo-300 tabular-nums">
          {cfg.categories.length}/{UPLOAD_CATEGORIES.length}
        </span>{" "}
        categorii
        {cfg.allowExt.length > 0 && <> · +{cfg.allowExt.length} extensii</>}
        {cfg.blockExt.length > 0 && (
          <>
            {" "}
            · <span className="text-red-300">{cfg.blockExt.length} blocate</span>
          </>
        )}
      </span>
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <FileCheck2 className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Tipuri de fișiere permise</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              Ce se poate încărca pe platformă — pe categorii, cu excepții pe extensii.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm sm:inline">{summary}</span>
          <button
            type="button"
            onClick={() => (open ? cancel() : setOpen(true))}
            aria-expanded={open}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              open
                ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
                : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
            }`}
          >
            {open ? "Anulează" : "Editează"}
          </button>
        </div>
      </div>

      <p className="mt-1 pl-12 text-sm sm:hidden">{summary}</p>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 pt-4 sm:pl-12">
              <ToggleRow on={restricted} onFlip={() => setRestricted((v) => !v)}>
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Restricționează tipurile de fișiere
                  </span>
                  <span className="block text-xs text-zinc-500">
                    Oprit = orice fișier se poate încărca.
                  </span>
                </span>
              </ToggleRow>

              <AnimatePresence initial={false}>
                {restricted && (
                  <motion.div
                    key="config"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-5">
                      <div>
                        <p className="mb-2.5 text-xs font-medium text-zinc-400">Categorii permise</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {UPLOAD_CATEGORIES.map((c) => (
                            <ToggleRow
                              key={c.key}
                              on={cats.has(c.key)}
                              onFlip={() =>
                                setCats((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(c.key)) next.delete(c.key);
                                  else next.add(c.key);
                                  return next;
                                })
                              }
                            >
                              <span className="text-sm text-zinc-200">{c.label}</span>
                            </ToggleRow>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="allowExt" className="mb-1.5 block text-sm font-medium text-zinc-300">
                            Extensii permise în plus
                          </label>
                          <input
                            id="allowExt"
                            type="text"
                            value={allowExt}
                            onChange={(e) => setAllowExt(e.target.value)}
                            placeholder="ex: psd, ai, dwg"
                            className={fieldCls}
                          />
                          <p className="mt-1 text-xs text-zinc-500">
                            Acceptate chiar dacă nu intră în categoriile de mai sus.
                          </p>
                        </div>
                        <div>
                          <label htmlFor="blockExt" className="mb-1.5 block text-sm font-medium text-zinc-300">
                            Extensii blocate
                          </label>
                          <input
                            id="blockExt"
                            type="text"
                            value={blockExt}
                            onChange={(e) => setBlockExt(e.target.value)}
                            placeholder="ex: exe, bat, msi"
                            className={fieldCls}
                          />
                          <p className="mt-1 text-xs text-zinc-500">
                            Respinse întotdeauna, indiferent de categorie.
                          </p>
                        </div>
                      </div>

                      {cats.size === 0 && allowExt.trim() === "" && (
                        <p className="text-xs text-amber-400/80">
                          Nicio categorie și nicio extensie permisă — nimic nu se va putea încărca.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form action={action}>
                <input type="hidden" name="restricted" value={String(restricted)} />
                {UPLOAD_CATEGORIES.map((c) => (
                  <input key={c.key} type="hidden" name={`cat_${c.key}`} value={String(cats.has(c.key))} />
                ))}
                <input type="hidden" name="allowExt" value={allowExt} />
                <input type="hidden" name="blockExt" value={blockExt} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {pending ? "Se salvează…" : "Salvează"}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
