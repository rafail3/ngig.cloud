"use client";

import { useState, type ReactNode } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMenuModality } from "@/lib/useMenuModality";
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
    // Collapsible owns the expanded/collapsed state, so the toggle gets
    // aria-expanded and aria-controls from the primitive instead of by hand, and
    // the panel is really hidden from assistive tech while closed.
    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} data-keep-selection>
      <div className="flex items-center gap-2.5">
        {/* Name search — fuzzy, instant. Quiet field that sharpens on focus. */}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
            placeholder="Caută pe tot cloud-ul…"
            aria-label="Caută fișiere și foldere pe tot cloud-ul"
            className="h-auto rounded-xl border-zinc-800 bg-zinc-900/60 py-2.5 pl-10 pr-10 text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:border-indigo-500/60 focus-visible:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500/15"
          />
          {f.query && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => f.setQuery("")}
              aria-label="Șterge căutarea"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full text-zinc-500 hover:bg-transparent hover:text-zinc-200 dark:hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filters toggle — the Tip/Dată/Mărime controls live behind this. */}
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`group h-auto shrink-0 gap-2 rounded-xl px-3.5 py-2.5 shadow-none ${
              filtersOpen || activeFilters > 0
                ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
            <span className="hidden sm:inline">Filtre</span>
            {activeFilters > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-xs font-semibold text-white">
                {activeFilters}
              </span>
            )}
            {/* Rotates from the Collapsible's own state — one source of truth. */}
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
      </div>

      {/* The menus below are portalled, so nothing here needs to open its
          overflow after the height animation to keep them from being clipped. */}
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="pt-3">
          <div className="flex items-center gap-2">
            {/* Type — multi-select; closes after each pick */}
            <FilterMenu
              label={typeLabel}
              icon={Shapes}
              active={f.types.size > 0}
              align="start"
              width="w-52"
            >
              {/* Items sit directly under the content — a wrapper div would hide
                  them from the primitive's arrow-key navigation. */}
              {TYPE_OPTIONS.map((t) => {
                const Icon = t.icon;
                return (
                  <DropdownMenuCheckboxItem
                    key={t.key}
                    checked={f.types.has(t.key)}
                    onCheckedChange={() => f.toggleType(t.key)}
                    className={OPTION_CLASS}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="flex-1">{t.label}</span>
                    {f.types.has(t.key) && (
                      <Check className="h-4 w-4 shrink-0 text-indigo-400" />
                    )}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </FilterMenu>

            {/* Date — single-select */}
            <FilterMenu label={dateLabel} icon={CalendarDays} active={f.date !== "any"} align="start" width="w-48">
              <RadioList options={DATE_OPTIONS} value={f.date} onPick={f.setDate} />
            </FilterMenu>

            {/* Size — single-select */}
            <FilterMenu label={sizeLabel} icon={HardDrive} active={f.size !== "any"} width="w-48">
              <RadioList options={SIZE_OPTIONS} value={f.size} onPick={f.setSize} />
            </FilterMenu>
          </div>

          {/* Reset sits on its own row below the chips, so adding it never
              pushes the filter chips onto a second line. */}
          {f.active && (
            <Button
              type="button"
              variant="ghost"
              onClick={f.reset}
              className="mt-2 h-auto rounded-full px-2.5 py-1 text-sm text-indigo-400 hover:bg-transparent hover:text-indigo-300 dark:hover:bg-transparent"
            >
              Resetează
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Radix draws its own tick in a reserved left gutter. This layout puts the
// meaning on the right instead, so the gutter is dropped and the indicator
// hidden — the checked/radio SEMANTICS still come from the primitive, only the
// mark is ours.
const OPTION_CLASS =
  "gap-2.5 rounded-lg py-2 pl-2.5 pr-2.5 text-zinc-300 focus:bg-zinc-800/70 focus:text-zinc-100 data-[state=checked]:bg-indigo-500/15 data-[state=checked]:text-zinc-100 [&>span:first-child]:hidden";

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
    <DropdownMenuRadioGroup value={value} onValueChange={(v) => onPick(v as T)}>
      {options.map((o) => (
        <DropdownMenuRadioItem key={o.key} value={o.key} className={OPTION_CLASS}>
          <span className="flex-1">{o.label}</span>
          {o.key === value && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

// A chip that opens its option list below it. The menu handles outside clicks,
// Escape, arrow keys and focus return; the chip only reports its own state.
function FilterMenu({
  label,
  icon: Icon,
  active,
  align = "end",
  width,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  // Which edge the panel aligns to. Leftmost chips use "start" so it opens
  // rightward and never spills off the left of the screen on mobile.
  align?: "start" | "end";
  width: string;
  children: ReactNode;
}) {
  const menu = useMenuModality();

  return (
    <div className="min-w-0 flex-1" data-keep-selection>
      <DropdownMenu>
        <DropdownMenuTrigger asChild {...menu.triggerProps}>
          <Button
            type="button"
            variant="outline"
            className={`group h-auto w-full justify-between gap-1.5 rounded-lg px-3.5 py-2 shadow-none ${
              active
                ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {Icon && <Icon className="hidden h-4 w-4 shrink-0 text-zinc-400 sm:block" />}
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          sideOffset={6}
          // Portalled to the body, so the attribute has to be repeated here —
          // picking a filter must not drop an active selection.
          data-keep-selection
          className={`${width} max-w-[calc(100vw-1.5rem)] rounded-xl border-zinc-800 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/30 backdrop-blur`}
          {...menu.contentProps}
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
