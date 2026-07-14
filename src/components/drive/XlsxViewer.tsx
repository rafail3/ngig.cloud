"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from "lucide-react";
import type { WorkBook, WorkSheet } from "xlsx";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.1;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Builds an Excel-like HTML grid for a worksheet: A/B/C column headers, 1/2/3
// row numbers, grid lines, merged cells. Values use Excel's formatted text.
async function buildGrid(ws: WorkSheet): Promise<string> {
  const XLSX = await import("xlsx");
  const ref = ws["!ref"];
  if (!ref) return '<p class="xlsx-empty">Foaie goală</p>';
  const range = XLSX.utils.decode_range(ref);
  const merges = ws["!merges"] ?? [];

  // Map cells hidden behind a merge, and the span of each merge's anchor cell.
  const covered = new Set<string>();
  const starts = new Map<string, { rs: number; cs: number }>();
  for (const m of merges) {
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) {
          starts.set(`${r},${c}`, {
            rs: m.e.r - m.s.r + 1,
            cs: m.e.c - m.s.c + 1,
          });
        } else {
          covered.add(`${r},${c}`);
        }
      }
    }
  }

  let html = '<table class="xlsx-grid"><thead><tr><th class="xlsx-corner"></th>';
  for (let c = range.s.c; c <= range.e.c; c++) {
    html += `<th>${XLSX.utils.encode_col(c)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (let r = range.s.r; r <= range.e.r; r++) {
    html += `<tr><th class="xlsx-rownum">${r + 1}</th>`;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = `${r},${c}`;
      if (covered.has(key)) continue;
      const st = starts.get(key);
      const span = st ? ` colspan="${st.cs}" rowspan="${st.rs}"` : "";
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const text = cell ? (cell.w ?? String(cell.v ?? "")) : "";
      const numeric = cell?.t === "n";
      html += `<td${span}${numeric ? ' class="xlsx-num"' : ""}>${escapeHtml(text)}</td>`;
    }
    html += "</tr>";
  }
  return html + "</tbody></table>";
}

export function XlsxViewer({
  url,
  onDownload,
}: {
  url: string;
  onDownload: () => void;
}) {
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [active, setActive] = useState(0);
  const [grid, setGrid] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // Load + parse the workbook once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const buf = await res.arrayBuffer();
        const XLSX = await import("xlsx");
        const book = XLSX.read(new Uint8Array(buf), { type: "array" });
        if (!alive) return;
        setWb(book);
        setActive(0);
        setState("ready");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  // Rebuild the grid when the active sheet changes.
  useEffect(() => {
    if (!wb) return;
    let alive = true;
    const ws = wb.Sheets[wb.SheetNames[active]];
    buildGrid(ws).then((html) => {
      if (alive) setGrid(html);
    });
    return () => {
      alive = false;
    };
  }, [wb, active]);

  const zoom = useCallback((dir: 1 | -1) => {
    setFitWidth(false);
    setScale((s) => {
      const next = Math.round((s + dir * ZOOM_STEP) * 100) / 100;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    });
  }, []);

  const ready = state === "ready" && wb !== null;

  // Fit-to-width: scale the grid so its full width fits the viewport (never
  // enlarge past 100%). `zoom` scales layout, so scrollWidth is the current
  // (scaled) width — divide by the current scale to recover the natural width.
  const computeFit = useCallback(() => {
    const el = scrollRef.current;
    const host = hostRef.current;
    if (!el || !host) return;
    const natural = host.scrollWidth / (scale || 1);
    if (!natural) return;
    setScale(Math.min(1, Math.max(MIN_SCALE, el.clientWidth / natural)));
  }, [scale]);

  useEffect(() => {
    if (!ready || !fitWidth) return;
    const id = requestAnimationFrame(() => computeFit());
    const onResize = () => computeFit();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [ready, fitWidth, grid, computeFit]);
  const names = wb?.SheetNames ?? [];

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950/60">
      {/* Toolbar: sheet tabs + zoom + download */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/80 px-2 py-2 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {names.map((name, i) => (
            <button
              key={name + i}
              type="button"
              onClick={() => setActive(i)}
              className={`max-w-[10rem] truncate rounded-md px-2.5 py-1 text-xs transition ${
                i === active
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
              title={name}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => zoom(-1)}
            disabled={!ready || scale <= MIN_SCALE}
            aria-label="Micșorează"
            className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 select-none text-center text-xs tabular-nums text-zinc-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoom(1)}
            disabled={!ready || scale >= MAX_SCALE}
            aria-label="Mărește"
            className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setFitWidth(true)}
            disabled={!ready}
            aria-label="Potrivește pe ecran"
            title="Potrivește pe ecran"
            className={`rounded-md border p-1.5 transition disabled:opacity-40 ${
              fitWidth
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDownload}
            aria-label="Descarcă"
            title="Descarcă"
            className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid — no padding so the sticky header row / row-number column pin
          flush to the scroll edges (padding would leave a gap). */}
      <div ref={scrollRef} className="flex-1 overflow-auto overscroll-contain bg-zinc-950/40">
        {state === "loading" && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        )}
        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-zinc-400">
              Nu am putut afișa foaia de calcul.
            </p>
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-sm font-medium text-white transition"
            >
              <Download className="h-4 w-4" /> Descarcă
            </button>
          </div>
        )}
        {ready && (
          <div
            ref={hostRef}
            className="xlsx-host w-fit"
            style={{ zoom: scale }}
            // Cell text is escaped in buildGrid, so the markup is safe to inject.
            dangerouslySetInnerHTML={{ __html: grid }}
          />
        )}
      </div>
    </div>
  );
}
