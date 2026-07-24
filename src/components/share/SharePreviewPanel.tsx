"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { SharePreviewKind } from "@/lib/share";

// Card-first: the public page shows the file card, and the preview opens only
// when the visitor asks for it. Keeps the first paint light and lets big media
// load on intent.
export function SharePreviewPanel({
  url,
  kind,
  name,
}: {
  url: string;
  kind: Exclude<SharePreviewKind, null>;
  name: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-5 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        {open ? (
          <>
            <EyeOff className="h-4 w-4" aria-hidden /> Ascunde previzualizarea
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" aria-hidden /> Previzualizează
          </>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <Preview url={url} kind={kind} name={name} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Preview({
  url,
  kind,
  name,
}: {
  url: string;
  kind: Exclude<SharePreviewKind, null>;
  name: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (kind === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Deschide imaginea la mărime completă"
        className="group relative block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60"
      >
        {!loaded && (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          </div>
        )}
        {/* Presigned B2 URL of an unknown remote object — a plain <img> avoids
            next/image's optimizer + host allow-list. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          onLoad={() => setLoaded(true)}
          className={`mx-auto max-h-[62vh] w-auto max-w-full object-contain transition-opacity duration-300 group-hover:opacity-95 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <video src={url} controls className="max-h-[62vh] w-full" />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  // pdf + text render in the browser's own viewer, sandboxed.
  return (
    <iframe
      src={url}
      title={name}
      sandbox=""
      className="h-[70vh] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
    />
  );
}
