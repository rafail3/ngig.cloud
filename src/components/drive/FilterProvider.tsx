"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fileCategory, type FileCategory } from "@/lib/file-type";
import { fuzzyScore } from "@/lib/fuzzy";

export type FolderInput = { id: string; name: string };
export type FileInput = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DateRange = "any" | "today" | "7d" | "30d" | "365d";
export type SizeRange = "any" | "small" | "medium" | "large";

// Size buckets, in bytes. Small = under 1 MB, large = 100 MB and up.
const SIZE_BOUNDS = { small: 1_000_000, large: 100_000_000 };

function sizeInRange(size: number, range: SizeRange): boolean {
  switch (range) {
    case "small":
      return size < SIZE_BOUNDS.small;
    case "medium":
      return size >= SIZE_BOUNDS.small && size < SIZE_BOUNDS.large;
    case "large":
      return size >= SIZE_BOUNDS.large;
    default:
      return true;
  }
}

// Cutoff timestamp (ms) a file's upload date must be at/after to pass the date
// filter. "today" is since local midnight; the rest are rolling windows.
function dateCutoff(range: DateRange, now: number): number {
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const day = 86_400_000;
  if (range === "7d") return now - 7 * day;
  if (range === "30d") return now - 30 * day;
  if (range === "365d") return now - 365 * day;
  return -Infinity;
}

/**
 * Whether a file passes the type/date/size filters (name matching is handled
 * separately). Shared by the in-folder filtering here and the global search
 * results, so both refine identically.
 */
export function fileMatchesFilters(
  file: { name: string; mimeType: string | null; size: number; createdAt: string },
  opts: {
    types: Set<FileCategory>;
    date: DateRange;
    size: SizeRange;
    dateBase: number;
  },
): boolean {
  if (
    opts.types.size > 0 &&
    !opts.types.has(fileCategory(file.name, file.mimeType))
  )
    return false;
  if (
    opts.date !== "any" &&
    new Date(file.createdAt).getTime() < dateCutoff(opts.date, opts.dateBase)
  )
    return false;
  if (opts.size !== "any" && !sizeInRange(file.size, opts.size)) return false;
  return true;
}

type FilterCtx = {
  query: string;
  setQuery: (v: string) => void;
  types: Set<FileCategory>;
  toggleType: (c: FileCategory) => void;
  date: DateRange;
  setDate: (d: DateRange) => void;
  size: SizeRange;
  setSize: (s: SizeRange) => void;
  reset: () => void;
  /** Timestamp base for the date window (captured when a date is picked). */
  dateBase: number;
  /** A query OR any filter is active → show global results, not the folder. */
  active: boolean;
  /** A file-only filter is on, so folders are hidden from the view. */
  fileFiltersActive: boolean;
  /** Raw item count (folders + files) — drives whether the bar shows at all. */
  totalItems: number;
  /** Filtered + ranked folders (empty when a file-only filter is active). */
  folders: FolderInput[];
  /** Filtered + ranked files for display. */
  files: FileInput[];
  /** Unfiltered files — for upload reconciliation, never for display. */
  rawFiles: FileInput[];
};

const Ctx = createContext<FilterCtx | null>(null);

export function useFilter(): FilterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFilter must be used within <FilterProvider>");
  return ctx;
}

export function FilterProvider({
  folders,
  files,
  children,
}: {
  folders: FolderInput[];
  files: FileInput[];
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<Set<FileCategory>>(() => new Set());
  const [date, setDateRaw] = useState<DateRange>("any");
  const [size, setSize] = useState<SizeRange>("any");
  // Reference "now" for the date window, captured when the user picks a date
  // (event handlers may call Date.now(); render must stay pure). Only read while
  // a date filter is active, so its initial 0 is never used.
  const [dateBase, setDateBase] = useState(0);
  const setDate = useCallback((d: DateRange) => {
    setDateBase(Date.now());
    setDateRaw(d);
  }, []);

  const toggleType = useCallback((c: FileCategory) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setTypes(new Set());
    setDate("any");
    setSize("any");
  }, [setDate]);

  const fileFiltersActive = types.size > 0 || date !== "any" || size !== "any";
  const q = query.trim();
  const active = q.length > 0 || fileFiltersActive;

  // Filter + rank folders: name (fuzzy) only. Hidden entirely once a file-only
  // filter is on — a folder has no type/size/date to satisfy it.
  const filteredFolders = useMemo<FolderInput[]>(() => {
    if (fileFiltersActive) return [];
    if (!q) return folders;
    return folders
      .map((f) => ({ f, score: fuzzyScore(q, f.name) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.f);
  }, [folders, q, fileFiltersActive]);

  const filteredFiles = useMemo<FileInput[]>(() => {
    if (!active) return files;

    const passes = files.filter((f) =>
      fileMatchesFilters(f, { types, date, size, dateBase }),
    );

    if (!q) return passes;
    return passes
      .map((f) => ({ f, score: fuzzyScore(q, f.name) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.f);
  }, [files, q, types, date, size, active, dateBase]);

  const value: FilterCtx = {
    query,
    setQuery,
    types,
    toggleType,
    date,
    setDate,
    size,
    setSize,
    reset,
    dateBase,
    active,
    fileFiltersActive,
    totalItems: folders.length + files.length,
    folders: filteredFolders,
    files: filteredFiles,
    rawFiles: files,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
