"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Sparkles } from "lucide-react";
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
// whole cloud. A collapsible card (closed by default) revealing horizontal file
// cards, click to preview. Hidden while searching/filtering. Data is SWR-keyed
// under "drive", so it live-updates with the rest of the drive.
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
    <section className="mb-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`group flex w-full items-center gap-3 rounded-2xl border bg-zinc-900/40 px-4 py-3 text-left transition-colors ${
          open ? "border-indigo-500/40" : "border-zinc-800/70 hover:border-zinc-700"
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-100">Fișiere sugerate</span>
          <span className="hidden text-xs text-zinc-500 sm:block">
            Cele mai active fișiere din cloud
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-300">
            {data.length}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform group-hover:text-zinc-300 ${
              open ? "rotate-180 text-indigo-400" : ""
            }`}
          />
        </span>
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
            <div className="grid grid-cols-1 gap-2.5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPreview(f)}
                  // Prevent the browser's double-click text selection on the card.
                  onMouseDown={(e) => e.preventDefault()}
                  title={f.name}
                  className="group/card flex min-w-0 select-none items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 text-left outline-none transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/70 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                >
                  <FileTypeIcon name={f.name} mime={f.mimeType} size="md" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-zinc-200">{f.name}</span>
                    <span className="truncate text-xs text-zinc-500">
                      {fileTypeShort(f.name, f.mimeType)} · {formatBytes(f.size)}
                    </span>
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
