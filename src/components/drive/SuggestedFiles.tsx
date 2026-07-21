"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useSuggested } from "./useDriveData";
import { FileTypeIcon } from "./FileTypeIcon";
import { useFilter } from "./FilterProvider";
import { PreviewModal, type PreviewFile } from "./PreviewModal";
import { getDownloadUrlAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { fileTypeShort } from "@/lib/file-type";

// Remember the section's open/closed choice per browser (starts closed).
const OPEN_KEY = "ngig:suggested-open";

// "Fișiere sugerate" on the home root: the most recently active files across the
// whole cloud. Collapsible (closed by default), compact tiles, click to preview.
// Hidden while searching/filtering (the global results take over). Data is
// SWR-keyed under "drive", so it live-updates with the rest of the drive.
export function SuggestedFiles() {
  const { data } = useSuggested();
  const { active } = useFilter();
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  // Restore the remembered state on mount (SSR renders closed to match).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(localStorage.getItem(OPEN_KEY) === "1");
  }, []);

  if (active) return null;
  if (!data || data.length === 0) return null;

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors (private mode etc.)
      }
      return next;
    });
  }

  async function download(id: string) {
    const res = await getDownloadUrlAction(id);
    if (typeof res !== "string") {
      window.location.assign("/login");
      return;
    }
    window.location.assign(res);
  }

  return (
    <section className="mb-6 border-b border-zinc-900 pb-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 text-left"
      >
        <span className="text-sm font-medium text-zinc-400 transition-colors group-hover:text-zinc-200">
          Fișiere sugerate
        </span>
        <span className="rounded-full bg-zinc-800/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-400">
          {data.length}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 text-zinc-500 transition-transform group-hover:text-zinc-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="grid"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2 pt-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {data.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPreview(f)}
                  // Prevent the browser's double-click text selection on the tile.
                  onMouseDown={(e) => e.preventDefault()}
                  title={f.name}
                  className="flex min-w-0 select-none flex-col gap-1.5 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-2.5 text-left outline-none transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/70 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                >
                  <FileTypeIcon name={f.name} mime={f.mimeType} size="sm" />
                  <span className="min-w-0 truncate text-xs font-medium text-zinc-200">
                    {f.name}
                  </span>
                  <span className="-mt-1 truncate text-[10px] text-zinc-500">
                    {fileTypeShort(f.name, f.mimeType)} · {formatBytes(f.size)}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {preview && (
        <PreviewModal
          file={preview}
          onClose={() => setPreview(null)}
          onDownload={() => download(preview.id)}
        />
      )}
    </section>
  );
}
