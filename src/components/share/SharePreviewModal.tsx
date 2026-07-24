"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
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

// A pop-up lightbox preview for a shared file, PORTALED to document.body so it
// escapes the share card's backdrop-blur (which creates a containing block that
// would otherwise trap `position: fixed` inside the card). PDFs render via
// pdf.js (canvas, no cross-origin iframe → not blocked by Brave); text loads
// into the code viewer; image/video/audio use native elements.
export function SharePreviewModal({
  target,
  onClose,
}: {
  target: SharePreviewTarget | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const tree = (
    <AnimatePresence>
      {target && <Lightbox key="lightbox" target={target} onClose={onClose} />}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
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

  const download = () => window.open(url, "_blank", "noopener");

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative flex max-h-[96dvh] w-[min(96vw,80rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 6 }}
        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
            {name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Deschide într-o filă nouă"
              title="Deschide"
              className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-950/50">
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
      <div className="flex h-full w-full items-center justify-center overflow-auto p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="max-h-[calc(96dvh-4rem)] max-w-full rounded object-contain"
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        autoPlay
        className="max-h-[calc(96dvh-4rem)] max-w-full"
      />
    );
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
      <div className="h-[calc(96dvh-3.25rem)] w-full">
        <Suspense fallback={<ViewerFallback />}>
          <PdfViewer url={url} fileName={name} onDownload={onDownload} />
        </Suspense>
      </div>
    );
  }
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

  return (
    <div className="h-[calc(96dvh-3.25rem)] w-full overflow-auto">
      {error ? (
        <p className="p-6 text-sm text-red-400">Nu am putut încărca fișierul.</p>
      ) : text === null ? (
        <ViewerFallback />
      ) : (
        <Suspense fallback={<ViewerFallback />}>
          <CodeViewer code={text} fileName={name} />
        </Suspense>
      )}
    </div>
  );
}
