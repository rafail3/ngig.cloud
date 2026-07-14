"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from "lucide-react";

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.2;
const FIT_PADDING = 24;

// Renders a .docx faithfully (fonts, colours, tables, images, page width and
// margins) with docx-preview, as one continuous document. The file is fetched
// client-side from the presigned B2 URL and never leaves the browser.
//
// NOTE: browser docx libraries have no layout engine, so they cannot split a
// document into real pages the way Word does. True page-by-page rendering is a
// separate task (server-side docx→PDF conversion, then our PDF viewer).
export function DocxViewer({
  url,
  onDownload,
}: {
  url: string;
  onDownload: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const baseWidthRef = useRef(0);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);

  // Fetch + render the document once, as a single continuous flow.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const buf = await res.arrayBuffer();
        const host = hostRef.current;
        if (!host || !active) return;
        const { renderAsync } = await import("docx-preview");
        host.innerHTML = "";
        await renderAsync(buf, host, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: false,
          experimental: true,
          useBase64URL: true,
        });
        if (!active) return;
        // Don't measure here: the host is still display:none (state !== "ready"),
        // so offsetWidth would be 0. We measure once the sheet is visible below.
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [url]);

  // Fit-to-width: scale the sheet down to the viewport on narrow screens, but
  // never blow it up past its natural size on desktop.
  const computeFit = useCallback(() => {
    const el = scrollRef.current;
    const base = baseWidthRef.current;
    if (!el || !base) return;
    const avail = el.clientWidth - FIT_PADDING;
    setScale(Math.min(1, Math.max(MIN_SCALE, avail / base)));
  }, []);

  useEffect(() => {
    if (state !== "ready") return;
    // Measure the page's natural width once it's actually visible (scale is 1
    // on first ready, so offsetWidth === natural width), then fit.
    const id = requestAnimationFrame(() => {
      if (!baseWidthRef.current) {
        const sheet = hostRef.current?.querySelector<HTMLElement>("section.docx");
        baseWidthRef.current = sheet?.offsetWidth ?? hostRef.current?.scrollWidth ?? 0;
      }
      if (fitWidth) computeFit();
    });
    const onResize = () => computeFit();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [state, fitWidth, computeFit]);

  const zoom = useCallback((dir: 1 | -1) => {
    setFitWidth(false);
    setScale((s) => {
      const next = Math.round((s + dir * ZOOM_STEP) * 100) / 100;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    });
  }, []);

  const ready = state === "ready";

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950/60">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-2 py-2 backdrop-blur">
        <div className="flex items-center gap-1">
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
        </div>

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

      {/* Document */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto overscroll-contain bg-zinc-950/40 p-2 sm:p-4"
      >
        {state === "loading" && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        )}
        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-zinc-400">
              Nu am putut afișa documentul.
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
        <div
          ref={hostRef}
          className="docx-host"
          style={{
            zoom: scale,
            display: state === "ready" ? "block" : "none",
          }}
        />
      </div>
    </div>
  );
}
