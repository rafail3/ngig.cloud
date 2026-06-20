"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Download, Loader2, FileQuestion, Info } from "lucide-react";
import { getViewUrlAction, getTextPreviewAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/format-date";
import { InfoModal } from "./InfoModal";
import { AudioPlayer } from "./AudioPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { PdfViewer } from "./PdfViewer";
import { panelSpring } from "./anim";

export type PreviewFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
};

const TEXT_EXT =
  /\.(txt|md|markdown|json|jsonc|js|jsx|ts|tsx|css|scss|html|xml|yml|yaml|csv|log|ini|env|sh|py|rb|go|rs|java|c|h|cpp|sql|toml)$/i;

function kind(mime: string | null, name: string) {
  const m = mime ?? "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("text/") || TEXT_EXT.test(name)) return "text";
  return "other";
}

export function PreviewModal({
  file,
  onClose,
  onDownload,
}: {
  file: PreviewFile;
  onClose: () => void;
  onDownload: () => void;
}) {
  const k = kind(file.mimeType, file.name);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    let active = true;
    getViewUrlAction(file.id)
      .then(async (res) => {
        if (!active) return;
        if ("revoked" in res) {
          window.location.assign("/login");
          return;
        }
        setUrl(res.url);
        if (k === "text") {
          const t = await getTextPreviewAction(file.id);
          if (!active) return;
          if ("revoked" in t) {
            window.location.assign("/login");
            return;
          }
          setText(t.text);
        }
      })
      .catch(() => active && setError("Nu am putut încărca preview-ul."));
    return () => {
      active = false;
    };
  }, [file.id, k]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Video loads behind a simple full-screen blur + centered spinner. */}
      {k === "video" && !videoReady && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-2xl">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-300 [animation-duration:0.7s]" />
        </div>
      )}

      <motion.div
        className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl ${
          k === "pdf"
            ? "h-[92vh] w-[min(96vw,80rem)] max-w-[96vw]"
            : "max-h-[90vh] w-auto max-w-[min(92vw,52rem)]"
        }`}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={panelSpring}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <p className="min-w-0 max-w-[min(60vw,32rem)] truncate text-sm font-medium text-zinc-100">
            {file.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" /> Descarcă
            </button>
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              aria-label="Detalii"
              className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition hover:bg-zinc-800"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="rounded p-1.5 text-zinc-400 transition hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className={
            k === "pdf"
              ? "flex min-h-0 flex-1 overflow-hidden bg-zinc-950/40"
              : "flex flex-1 items-center justify-center overflow-auto bg-zinc-950/40 p-3"
          }
        >
          {error && <p className="py-10 text-sm text-red-400">{error}</p>}
          {!error && !url && k !== "video" && (
            <div className={k === "pdf" ? "flex w-full items-center justify-center" : ""}>
              <Loader2 className="my-10 h-6 w-6 animate-spin text-indigo-400" />
            </div>
          )}

          {url && k === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={file.name}
              className="max-h-[80vh] max-w-full rounded object-contain"
            />
          )}
          {url && k === "video" && (
            <VideoPlayer url={url} onReady={() => setVideoReady(true)} />
          )}
          {url && k === "audio" && <AudioPlayer url={url} />}
          {url && k === "pdf" && (
            <PdfViewer url={url} fileName={file.name} onDownload={onDownload} />
          )}
          {url && k === "text" &&
            (text === null ? (
              <Loader2 className="my-10 h-6 w-6 animate-spin text-indigo-400" />
            ) : (
              <pre className="max-h-[80vh] w-[min(80vw,48rem)] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/70 to-zinc-900/30 p-4 text-left font-mono text-xs leading-relaxed text-zinc-200 shadow-inner backdrop-blur">
                {text}
              </pre>
            ))}
          {url && k === "other" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileQuestion className="h-10 w-10 text-zinc-600" />
              <p className="text-sm text-zinc-400">
                Fără previzualizare pentru acest tip de fișier.
              </p>
              <button
                type="button"
                onClick={onDownload}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:from-indigo-400 hover:to-violet-400"
              >
                <Download className="h-4 w-4" /> Descarcă
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showInfo && (
          <InfoModal
            key="preview-info"
            title={file.name}
            onClose={() => setShowInfo(false)}
            lockScroll={false}
            rows={[
              { label: "Dimensiune", value: formatBytes(file.size) },
              { label: "Tip", value: file.mimeType ?? "necunoscut" },
              { label: "Încărcat", value: formatDateTime(file.createdAt) },
            ]}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
