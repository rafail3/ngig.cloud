"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  Download,
  Loader2,
} from "lucide-react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import { printPdf } from "./print-blob";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;
// Horizontal breathing room inside the scroll area when fitting a page to width.
const FIT_PADDING = 32;

type PageSize = { width: number; height: number };

// pdfjs is loaded lazily (browser-only) and the worker is wired up once.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function PdfViewer({
  url,
  fileName,
  onDownload,
}: {
  url: string;
  fileName: string;
  onDownload: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [page, setPage] = useState(1);
  const [printing, setPrinting] = useState(false);

  // Load the document + every page's natural size (so we can reserve scroll
  // space before a page lazily renders).
  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({ url, isOffscreenCanvasSupported: true });
        const loaded = await task.promise;
        if (!active) return;
        const dims: PageSize[] = [];
        for (let n = 1; n <= loaded.numPages; n++) {
          const pg = await loaded.getPage(n);
          const vp = pg.getViewport({ scale: 1 });
          dims.push({ width: vp.width, height: vp.height });
          if (!active) return;
        }
        pageRefs.current = new Array(loaded.numPages).fill(null);
        setSizes(dims);
        setDoc(loaded);
      } catch {
        if (active) setError("Nu am putut încărca documentul PDF.");
      }
    })();

    return () => {
      active = false;
      task?.destroy();
    };
  }, [url]);

  // Fit-to-width: derive the scale from the widest page and the viewport.
  const computeFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || sizes.length === 0) return;
    const avail = el.clientWidth - FIT_PADDING;
    const widest = Math.max(...sizes.map((s) => s.width));
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, avail / widest));
    setScale(next);
  }, [sizes]);

  useEffect(() => {
    if (!fitWidth) return;
    computeFit();
    const onResize = () => computeFit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitWidth, computeFit]);

  // Track the page currently under the top of the scroll area.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop + 96;
    let current = 1;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const node = pageRefs.current[i];
      if (node && node.offsetTop <= top) current = i + 1;
      else break;
    }
    setPage(current);
  }, []);

  const goToPage = useCallback((n: number) => {
    const node = pageRefs.current[n - 1];
    const el = scrollRef.current;
    if (node && el) el.scrollTo({ top: node.offsetTop - 12, behavior: "smooth" });
  }, []);

  const zoom = useCallback((dir: 1 | -1) => {
    setFitWidth(false);
    setScale((s) => {
      const next = Math.round((s + dir * ZOOM_STEP) * 100) / 100;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    });
  }, []);

  const print = useCallback(async () => {
    if (!doc) return;
    setPrinting(true);
    try {
      const data = await doc.getData();
      printPdf(new Blob([data as BlobPart], { type: "application/pdf" }));
    } finally {
      setPrinting(false);
    }
  }, [doc]);

  const numPages = sizes.length;
  const ready = doc && numPages > 0;

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950/60">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-b border-zinc-800 bg-zinc-900/80 px-2 py-2 backdrop-blur sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={!ready || page <= 1}
            aria-label="Pagina anterioară"
            className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToPage(Math.min(numPages, page + 1))}
            disabled={!ready || page >= numPages}
            aria-label="Pagina următoare"
            className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <span className="ml-1 select-none text-xs tabular-nums text-zinc-400">
            {ready ? `${page} / ${numPages}` : "—"}
          </span>
        </div>

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
            aria-label="Potrivește pe lățime"
            title="Potrivește pe lățime"
            className={`rounded-md border p-1.5 transition disabled:opacity-40 ${
              fitWidth
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={print}
            disabled={!ready || printing}
            aria-label="Printează"
            title="Printează"
            className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {printing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
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

      {/* Pages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto overscroll-contain bg-zinc-950/40 px-2 py-3"
      >
        {error && (
          <p className="py-10 text-center text-sm text-red-400">{error}</p>
        )}
        {!error && !ready && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        )}
        {ready && (
          <div className="mx-auto flex w-fit flex-col items-center gap-3">
            {sizes.map((size, i) => (
              <PdfPage
                key={i}
                ref={(node) => {
                  pageRefs.current[i] = node;
                }}
                doc={doc}
                pageNumber={i + 1}
                baseSize={size}
                scale={scale}
                rootRef={scrollRef}
              />
            ))}
          </div>
        )}
      </div>
      {/* Accessible label for the document. */}
      <span className="sr-only">{fileName}</span>
    </div>
  );
}

const PdfPage = ({
  ref,
  doc,
  pageNumber,
  baseSize,
  scale,
  rootRef,
}: {
  ref: (node: HTMLDivElement | null) => void;
  doc: PDFDocumentProxy;
  pageNumber: number;
  baseSize: PageSize;
  scale: number;
  rootRef: RefObject<HTMLDivElement | null>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const width = Math.floor(baseSize.width * scale);
  const height = Math.floor(baseSize.height * scale);

  // Render only pages near the viewport.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { root: rootRef.current, rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [rootRef]);

  // (Re)render the page whenever it becomes visible or the scale changes.
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let task: RenderTask | null = null;
    let cancelled = false;

    (async () => {
      const pageProxy = await doc.getPage(pageNumber);
      if (cancelled) return;
      const outputScale = window.devicePixelRatio || 1;
      const viewport = pageProxy.getViewport({ scale });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      task = pageProxy.render({ canvas, canvasContext: ctx, viewport, transform });
      try {
        await task.promise;
      } catch {
        // Render cancelled (scale changed / unmounted) — safe to ignore.
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, scale, doc, pageNumber]);

  return (
    <div
      ref={(node) => {
        wrapRef.current = node;
        ref(node);
      }}
      style={{ width, height }}
      className="relative overflow-hidden rounded-sm bg-white shadow-lg shadow-black/40 ring-1 ring-black/5"
    >
      {!visible && (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
        </div>
      )}
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};
