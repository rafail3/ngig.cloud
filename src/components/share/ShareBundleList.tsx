"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { File as FileIcon, Folder, ChevronDown, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { ShareBundleItemView, SharePreviewKind } from "@/lib/share";

// The members of a bundle link. A previewable file is a button that expands a
// medium inline preview; folders and non-previewable files are plain rows.
export function ShareBundleList({ items }: { items: ShareBundleItemView[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto">
      {items.map((item, i) => {
        const canPreview = item.previewUrl != null && item.previewKind != null;
        const isOpen = openIdx === i;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => canPreview && setOpenIdx(isOpen ? null : i)}
              aria-expanded={canPreview ? isOpen : undefined}
              className={`flex w-full items-center gap-2.5 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5 text-left transition-colors ${
                canPreview ? "cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/60" : "cursor-default"
              }`}
            >
              <span className="text-indigo-400" aria-hidden>
                {item.kind === "folder" ? (
                  <Folder className="h-4 w-4" />
                ) : (
                  <FileIcon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                {item.name}
              </span>
              {item.size != null && (
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {formatBytes(item.size)}
                </span>
              )}
              {canPreview && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              )}
            </button>

            <AnimatePresence initial={false}>
              {isOpen && canPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-1.5">
                    <ItemPreview
                      url={item.previewUrl!}
                      kind={item.previewKind!}
                      name={item.name}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

function ItemPreview({
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
        title="Deschide la mărime completă"
        className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
      >
        {!loaded && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          onLoad={() => setLoaded(true)}
          className={`mx-auto max-h-[46vh] w-auto max-w-full object-contain transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </a>
    );
  }
  if (kind === "video") {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
        <video src={url} controls className="max-h-[46vh] w-full" />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  return (
    <iframe
      src={url}
      title={name}
      sandbox=""
      className="h-[52vh] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
    />
  );
}
