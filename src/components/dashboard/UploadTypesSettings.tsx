"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileCheck2, Search, ShieldBan } from "lucide-react";
import { saveUploadTypesAction } from "@/app/dashboard/(panel)/settings/actions";
import { useToastState } from "@/lib/useToastState";
import { EXT_CATALOG, normalizeExtList, type UploadTypesConfig } from "@/lib/upload-types";
import type { SettingsState } from "@/lib/settings-state";

const initial: SettingsState = {};

const CATALOG_EXTS = new Set(EXT_CATALOG.map((e) => e.ext));

// One extension cell: the whole row is the switch. ON (red) = blocked.
function ExtToggle({
  ext,
  label,
  on,
  onFlip,
}: {
  ext: string;
  label: string;
  on: boolean;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Blochează .${ext}`}
      onClick={onFlip}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
        on
          ? "border-red-500/40 bg-red-500/10"
          : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/60"
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${
          on ? "bg-red-500" : "bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${
            on ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span
        className={`font-mono text-xs font-semibold ${on ? "text-red-300 line-through" : "text-zinc-200"}`}
      >
        {ext}
      </span>
      <span className="ml-auto truncate text-[10px] text-zinc-500">{label}</span>
    </button>
  );
}

// Super-admin card: which extensions are BLOCKED on upload. Default = nothing
// blocked (everything allowed); flipping a switch ON blocks that extension.
export function UploadTypesSettings({ cfg }: { cfg: UploadTypesConfig }) {
  const [state, action, pending] = useActionState(saveUploadTypesAction, initial);
  useToastState(state);

  const saved = useMemo(() => new Set(cfg?.blockExt ?? []), [cfg]);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set(saved));
  const [query, setQuery] = useState("");
  // Blocked extensions outside the catalog (typed in the custom field).
  const [custom, setCustom] = useState(
    [...saved].filter((e) => !CATALOG_EXTS.has(e)).join(", "),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  function cancel() {
    setBlocked(new Set(saved));
    setCustom([...saved].filter((e) => !CATALOG_EXTS.has(e)).join(", "));
    setQuery("");
    setOpen(false);
  }

  function flip(ext: string) {
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? EXT_CATALOG.filter(
        (e) => e.ext.includes(q) || e.label.toLowerCase().includes(q),
      )
    : EXT_CATALOG;

  // The form sends only catalog toggles here; the custom field rides separately.
  const blockedCsv = [...blocked].filter((e) => CATALOG_EXTS.has(e)).join(",");
  const totalBlocked = new Set([
    ...[...blocked].filter((e) => CATALOG_EXTS.has(e)),
    ...normalizeExtList(custom),
  ]).size;

  const savedCount = saved.size;
  const summary =
    savedCount === 0 ? (
      <span className="font-semibold text-emerald-300">Toate extensiile permise</span>
    ) : (
      <span className="text-zinc-400">
        <span className="font-semibold text-red-300 tabular-nums">{savedCount}</span>{" "}
        {savedCount === 1 ? "extensie blocată" : "extensii blocate"}
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
            <p className="text-sm font-medium text-zinc-100">Extensii blocate la upload</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              Totul e permis implicit — pornește switch-ul pe o extensie ca s-o blochezi.
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
            <div className="flex flex-col gap-4 pt-4">
              {/* Search + live counter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Caută extensie sau tip…"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-2 pl-9 pr-3 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <ShieldBan className="h-3.5 w-3.5 text-red-400" />
                  <span className="tabular-nums font-medium text-zinc-300">{totalBlocked}</span>{" "}
                  blocate
                </span>
              </div>

              {/* Compact extension grid — popular first, scrolls past ~7 rows. */}
              <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-2">
                {visible.length === 0 ? (
                  <p className="p-4 text-center text-sm text-zinc-500">
                    Nicio extensie nu se potrivește căutării.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {visible.map((e) => (
                      <ExtToggle
                        key={e.ext}
                        ext={e.ext}
                        label={e.label}
                        on={blocked.has(e.ext)}
                        onFlip={() => flip(e.ext)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Anything exotic that isn't in the catalog. */}
              <div>
                <label htmlFor="customExt" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Alte extensii blocate <span className="text-zinc-500">(opțional)</span>
                </label>
                <input
                  id="customExt"
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="ex: torrent, lnk"
                  className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              <form action={action}>
                <input type="hidden" name="blocked" value={blockedCsv} />
                <input type="hidden" name="custom" value={custom} />
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
