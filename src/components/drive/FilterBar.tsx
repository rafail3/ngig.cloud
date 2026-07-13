"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useClickOutside } from "@/lib/useClickOutside";
import {
  Search,
  X,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Shapes,
  CalendarDays,
  HardDrive,
  Image as ImageIcon,
  FileText,
  Table,
  Presentation,
  Code,
  Video,
  Music,
  Archive,
  File as FileIcon,
  type LucideIcon,
} from "lucide-react";
import type { FileCategory } from "@/lib/file-type";
import {
  useFilter,
  type DateRange,
  type SizeRange,
} from "./FilterProvider";

// `short` is what the chip shows (kept compact so all chips fit one row on
// mobile); `label` is the full text shown inside the dropdown.
const TYPE_OPTIONS: { key: FileCategory; label: string; short: string; icon: LucideIcon }[] = [
  { key: "image", label: "Imagini", short: "Imagini", icon: ImageIcon },
  { key: "document", label: "Documente", short: "Docs", icon: FileText },
  { key: "spreadsheet", label: "Foi de calcul", short: "Foi", icon: Table },
  { key: "presentation", label: "Prezentări", short: "Prez.", icon: Presentation },
  { key: "code", label: "Cod", short: "Cod", icon: Code },
  { key: "video", label: "Video", short: "Video", icon: Video },
  { key: "audio", label: "Audio", short: "Audio", icon: Music },
  { key: "archive", label: "Arhive", short: "Arhive", icon: Archive },
  { key: "other", label: "Altele", short: "Altele", icon: FileIcon },
];

const DATE_OPTIONS: { key: DateRange; label: string; short: string }[] = [
  { key: "any", label: "Oricând", short: "Oricând" },
  { key: "today", label: "Azi", short: "Azi" },
  { key: "7d", label: "Ultimele 7 zile", short: "7 zile" },
  { key: "30d", label: "Ultimele 30 de zile", short: "30 zile" },
  { key: "365d", label: "Ultimul an", short: "1 an" },
];

const SIZE_OPTIONS: { key: SizeRange; label: string; short: string }[] = [
  { key: "any", label: "Orice mărime", short: "Mărime" },
  { key: "small", label: "Mici (sub 1 MB)", short: "Mici" },
  { key: "medium", label: "Medii (1–100 MB)", short: "Medii" },
  { key: "large", label: "Mari (peste 100 MB)", short: "Mari" },
];

export function FilterBar() {
  const f = useFilter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // `revealed` flips overflow to visible only AFTER the expand animation, so the
  // Tip/Dată/Mărime dropdown popovers (positioned below their buttons) aren't
  // clipped by the overflow-hidden used to clip the height animation.
  const [revealed, setRevealed] = useState(false);

  function toggleFilters() {
    setRevealed(false); // clip while either expanding or collapsing
    setFiltersOpen((v) => !v);
  }

  // Hide the bar in a folder with nothing to filter — keeps an empty folder calm.
  if (f.totalItems === 0) return null;

  const typeLabel =
    f.types.size === 0
      ? "Tip"
      : f.types.size === 1
        ? TYPE_OPTIONS.find((t) => f.types.has(t.key))?.short ?? "Tip"
        : `Tip · ${f.types.size}`;
  const dateLabel = DATE_OPTIONS.find((d) => d.key === f.date)?.short ?? "Oricând";
  const sizeLabel = SIZE_OPTIONS.find((s) => s.key === f.size)?.short ?? "Mărime";

  const activeFilters =
    f.types.size + (f.date !== "any" ? 1 : 0) + (f.size !== "any" ? 1 : 0);

  return (
    <div data-keep-selection className="mb-6">
      <div className="flex items-center gap-2.5">
        {/* Name search — fuzzy, instant. Rounded pill with a soft, faded glow
            that warms up on focus. */}
        <div className="group relative min-w-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 rounded-full bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-fuchsia-500/30 opacity-40 blur-lg transition-opacity duration-300 group-focus-within:opacity-80"
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={f.query}
              onChange={(e) => f.setQuery(e.target.value)}
              placeholder="Caută pe tot cloud-ul…"
              aria-label="Caută fișiere și foldere pe tot cloud-ul"
              className="w-full rounded-full border border-zinc-800 bg-zinc-900/90 py-3 pl-11 pr-10 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-500 transition focus:border-indigo-500/70 focus:outline-none"
            />
            {f.query && (
              <button
                type="button"
                onClick={() => f.setQuery("")}
                aria-label="Șterge căutarea"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-500 transition hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters toggle — the Tip/Dată/Mărime controls live behind this. */}
        <button
          type="button"
          onClick={toggleFilters}
          aria-expanded={filtersOpen}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-3 text-sm transition ${
            filtersOpen || activeFilters > 0
              ? "border-indigo-500/60 bg-indigo-500/10 text-zinc-100"
              : "border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
          <span className="hidden sm:inline">Filtre</span>
          {activeFilters > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-xs font-semibold text-white">
              {activeFilters}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Revealed filter controls */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onAnimationComplete={() => setRevealed(true)}
            // Clipped during the height animation; visible once expanded so the
            // dropdown popovers below the buttons aren't cut off.
            className={revealed ? "" : "overflow-hidden"}
          >
            <div className="pt-3">
             <div className="flex items-center gap-2">
              {/* Type — multi-select; closes after each pick */}
              <Dropdown label={typeLabel} icon={Shapes} active={f.types.size > 0} align="left">
                {(close) => (
                  <div className="grid w-52 gap-0.5">
                    {TYPE_OPTIONS.map((t) => {
                      const on = f.types.has(t.key);
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            f.toggleType(t.key);
                            close();
                          }}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                            on
                              ? "bg-indigo-500/15 text-zinc-100"
                              : "text-zinc-300 hover:bg-zinc-800/70"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                          <span className="flex-1">{t.label}</span>
                          {on && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Dropdown>

              {/* Date — single-select */}
              <Dropdown label={dateLabel} icon={CalendarDays} active={f.date !== "any"} align="left">
                {(close) => (
                  <RadioList
                    options={DATE_OPTIONS}
                    value={f.date}
                    onPick={(v) => {
                      f.setDate(v);
                      close();
                    }}
                  />
                )}
              </Dropdown>

              {/* Size — single-select */}
              <Dropdown label={sizeLabel} icon={HardDrive} active={f.size !== "any"}>
                {(close) => (
                  <RadioList
                    options={SIZE_OPTIONS}
                    value={f.size}
                    onPick={(v) => {
                      f.setSize(v);
                      close();
                    }}
                  />
                )}
              </Dropdown>

             </div>

              {/* Reset sits on its own row below the chips, so adding it never
                  pushes the filter chips onto a second line. */}
              {f.active && (
                <button
                  type="button"
                  onClick={f.reset}
                  className="mt-2 rounded-full px-2.5 py-1 text-sm text-indigo-400 transition hover:text-indigo-300"
                >
                  Resetează
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// A single-choice option list used by the Date and Size dropdowns.
function RadioList<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { key: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="grid w-48 gap-0.5">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition ${
              on ? "bg-indigo-500/15 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800/70"
            }`}
          >
            <span className="flex-1">{o.label}</span>
            {on && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
          </button>
        );
      })}
    </div>
  );
}

// A button that toggles a popover panel below it. Children may be static content
// (Type) or a render function receiving a `close` callback (Date/Size).
function Dropdown({
  label,
  icon: Icon,
  active,
  align = "right",
  children,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  // Which edge the popover aligns to. Leftmost chips use "left" so the panel
  // opens rightward and never spills off the left of the screen on mobile.
  align?: "left" | "right";
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} data-keep-selection className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-full border px-3.5 py-2 text-sm transition ${
          active
            ? "border-indigo-500/60 bg-indigo-500/10 text-zinc-100"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {Icon && <Icon className="hidden h-4 w-4 shrink-0 text-zinc-400 sm:block" />}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={`absolute z-50 mt-1.5 max-w-[calc(100vw-1.5rem)] rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/30 backdrop-blur ${
              align === "left" ? "left-0" : "right-0"
            }`}
          >
            {typeof children === "function" ? children(close) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
