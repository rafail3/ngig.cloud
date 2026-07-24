"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Download, Loader2 } from "lucide-react";
import type { SharePreviewKind } from "@/lib/share";

// pdf.js + CodeMirror are heavy — keep them out of the public page's initial
// bundle and load them only when a pdf/text preview is actually opened.
const PdfViewer = lazy(() =>
  import("@/components/drive/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);
const CodeViewer = lazy(() =>
  import("@/components/drive/CodeViewer").then((m) => ({ default: m.CodeViewer })),
);

function ViewerFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </div>
  );
}

export type SharePreviewTarget = {
  url: string;
  kind: Exclude<SharePreviewKind, null>;
  name: string;
};

// A pop-up lightbox preview for a shared file. PDFs render via pdf.js (canvas,
// no cross-origin iframe → not blocked by Brave/ad-blockers); text is fetched
// and shown in the code viewer; image/video/audio use native elements.
export function SharePreviewModal({
  target,
  onClose,
}: {
  target: SharePreviewTarget | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {target && <Lightbox key="lightbox" target={target} onClose={onClose} />}
    </AnimatePresence>
  );
}

function Lightbox({
  target,
  onClose,
}: {
  target: SharePreviewTarget;
  onClose: () => void;
}) {
  const { url, kind, name } = target;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Documents get a large, tall panel; media sizes to its content.
  const big = kind === "pdf" || kind === "text";
  const download = () => window.open(url, "_blank", "noopener");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl ${
          big
            ? "h-[92vh] w-[min(96vw,72rem)]"
            : "max-h-[92vh] w-auto max-w-[min(94vw,60rem)]"
        }`}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
            {name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Deschide / descarcă"
              title="Deschide"
              className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="rounded-md p-1.5 text-zinc-400 transition hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className={
            big
              ? "min-h-0 flex-1 overflow-hidden bg-zinc-950/40"
              : "flex flex-1 items-center justify-center overflow-auto bg-zinc-950/40 p-3"
          }
        >
          <PreviewBody url={url} kind={kind} name={name} onDownload={download} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function PreviewBody({
  url,
  kind,
  name,
  onDownload,
}: {
  url: string;
  kind: Exclude<SharePreviewKind, null>;
  name: string;
  onDownload: () => void;
}) {
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="max-h-[82vh] max-w-full rounded object-contain"
      />
    );
  }
  if (kind === "video") {
    return <video src={url} controls autoPlay className="max-h-[82vh] max-w-full rounded" />;
  }
  if (kind === "audio") {
    return (
      <div className="w-full max-w-lg p-6">
        <audio src={url} controls autoPlay className="w-full" />
      </div>
    );
  }
  if (kind === "pdf") {
    return (
      <Suspense fallback={<ViewerFallback />}>
        <PdfViewer url={url} fileName={name} onDownload={onDownload} />
      </Suspense>
    );
  }
  // text
  return <TextBody url={url} name={name} />;
}

function TextBody({ url, name }: { url: string; name: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    // Cap what we pull so a huge log doesn't lock the viewer.
    fetch(url, { headers: { Range: "bytes=0-500000" } })
      .then((r) => r.text())
      .then((t) => active && setText(t))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [url]);

  if (error) {
    return <p className="p-6 text-sm text-red-400">Nu am putut încărca fișierul.</p>;
  }
  if (text === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }
  return (
    <div className="h-full w-full overflow-auto">
      <Suspense fallback={<ViewerFallback />}>
        <CodeViewer code={text} fileName={name} />
      </Suspense>
    </div>
  );
}
