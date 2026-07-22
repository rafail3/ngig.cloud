"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileCheck2, Search, ShieldBan, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
        .{ext}
      </span>
      <span className="ml-auto truncate text-[10px] text-zinc-500">{label}</span>
    </button>
  );
}

// Super-admin card: which extensions are BLOCKED on upload. Default = nothing
// blocked (everything allowed); flipping a switch ON blocks that extension.
// Custom extensions join the grid as first-class cells; turning one OFF
// removes it (it only exists because it was blocked). Every change saves on
// its own (debounced) — the panel button just closes.
export function UploadTypesSettings({ cfg }: { cfg: UploadTypesConfig }) {
  const [state, action, pending] = useActionState(saveUploadTypesAction, initial);
  useToastState(state);

  const saved = useMemo(() => new Set(cfg?.blockExt ?? []), [cfg]);
  const savedCustom = useMemo(
    () => [...saved].filter((e) => !CATALOG_EXTS.has(e)),
    [saved],
  );

  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set(saved));
  const [customExts, setCustomExts] = useState<string[]>(savedCustom);
  const [query, setQuery] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [draft, setDraft] = useState("");

  // Auto-save: any user change schedules a debounced submit of the hidden form,
  // so rapid toggling lands as one write. dirtyRef keeps prop-sync and mount
  // from triggering saves.
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const t = setTimeout(() => formRef.current?.requestSubmit(), 500);
    return () => clearTimeout(t);
  }, [blocked, customExts]);

  // While the panel is open the local state is the source of truth (saves flow
  // local → server). Re-sync from the server only when closed, so an in-flight
  // save can never clobber a toggle made right after it.
  useEffect(() => {
    if (open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocked(new Set(saved));
    setCustomExts([...saved].filter((e) => !CATALOG_EXTS.has(e)));
  }, [saved, open]);

  function close() {
    // Flush an unsaved change immediately — closing before the debounce fires
    // would unmount the form and silently drop it.
    const unsaved =
      blocked.size !== saved.size || [...blocked].some((e) => !saved.has(e));
    if (unsaved) formRef.current?.requestSubmit();
    setQuery("");
    setOnlyBlocked(false);
    setDraft("");
    setOpen(false);
  }

  // Toggling a custom cell OFF removes it from the grid entirely.
  function flip(ext: string, isCustom: boolean) {
    dirtyRef.current = true;
    if (isCustom) {
      setCustomExts((prev) => prev.filter((e) => e !== ext));
      setBlocked((prev) => {
        const next = new Set(prev);
        next.delete(ext);
        return next;
      });
      return;
    }
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  }

  // Add a custom extension: validated, deduped against catalog + existing
  // customs, then it lands in the grid already blocked.
  function addCustom() {
    const exts = normalizeExtList(draft);
    if (exts.length === 0) {
      toast.error("Extensie invalidă (ex: torrent).");
      return;
    }
    let added = 0;
    for (const ext of exts) {
      if (CATALOG_EXTS.has(ext) || customExts.includes(ext)) {
        toast.error(`Extensia .${ext} există deja în tabel.`);
        continue;
      }
      dirtyRef.current = true;
      setCustomExts((prev) => [ext, ...prev]);
      setBlocked((prev) => new Set(prev).add(ext));
      added++;
    }
    if (added > 0) setDraft("");
  }

  const q = query.trim().toLowerCase().replace(/^\.+/, "");
  const items = [
    ...customExts.map((ext) => ({ ext, label: "Custom", custom: true })),
    ...EXT_CATALOG.map((e) => ({ ...e, custom: false })),
  ].filter((e) => {
    if (onlyBlocked && !blocked.has(e.ext)) return false;
    if (q && !e.ext.includes(q) && !e.label.toLowerCase().includes(q)) return false;
    return true;
  });

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
          {pending && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Se salvează…
            </span>
          )}
          <span className="hidden text-sm sm:inline">{summary}</span>
          <button
            type="button"
            onClick={() => (open ? close() : setOpen(true))}
            aria-expanded={open}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              open
                ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
                : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
            }`}
          >
            {open ? "Închide" : "Editează"}
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
              {/* Search + filter + add */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-0 flex-1 sm:max-w-[15rem]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Caută extensie sau tip…"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-2 pl-9 pr-3 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                {/* All / blocked-only filter */}
                <div
                  role="radiogroup"
                  aria-label="Filtru extensii"
                  className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!onlyBlocked}
                    onClick={() => setOnlyBlocked(false)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      !onlyBlocked ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/25" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Toate
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={onlyBlocked}
                    onClick={() => setOnlyBlocked(true)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      onlyBlocked ? "bg-red-500 text-white shadow-sm shadow-red-500/25" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <ShieldBan className="h-3 w-3" />
                    Blocate
                    <span className="tabular-nums">({blocked.size})</span>
                  </button>
                </div>

                {/* Add a custom extension into the grid */}
                <div className="flex min-w-0 items-center gap-1.5">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    placeholder="ex: torrent"
                    aria-label="Adaugă extensie custom"
                    className="w-28 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 font-mono text-xs text-zinc-50 outline-none transition placeholder:font-sans placeholder:text-zinc-500 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <button
                    type="button"
                    onClick={addCustom}
                    className="flex items-center gap-1 rounded-lg border border-zinc-800 px-2.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-200"
                  >
                    <Plus className="h-3.5 w-3.5" /> Blochează
                  </button>
                </div>
              </div>

              {/* Compact extension grid — customs first, then popular. */}
              <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-2">
                {items.length === 0 ? (
                  <p className="p-4 text-center text-sm text-zinc-500">
                    {onlyBlocked && blocked.size === 0
                      ? "Nicio extensie blocată."
                      : "Nicio extensie nu se potrivește căutării."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((e) => (
                      <ExtToggle
                        key={e.ext}
                        ext={e.ext}
                        label={e.label}
                        on={blocked.has(e.ext)}
                        onFlip={() => flip(e.ext, e.custom)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Invisible form: changes auto-submit it (debounced) — no
                  manual save button. */}
              <form ref={formRef} action={action} className="hidden">
                <input type="hidden" name="blocked" value={[...blocked].join(",")} />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
