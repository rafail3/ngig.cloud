"use client";

import { useState } from "react";
import { useSuggested } from "./useDriveData";
import { FileTypeIcon } from "./FileTypeIcon";
import { useFilter } from "./FilterProvider";
import { PreviewModal, type PreviewFile } from "./PreviewModal";
import { getDownloadUrlAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { fileTypeShort } from "@/lib/file-type";

// "Fișiere sugerate" on the home root: the most recently active files across the
// whole cloud, click to preview. Hidden while searching/filtering (the global
// results take over). Data is SWR-keyed under "drive", so it live-updates with
// the rest of the drive (realtime + revalidateDrive).
export function SuggestedFiles() {
  const { data } = useSuggested();
  const { active } = useFilter();
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  if (active) return null;
  if (!data || data.length === 0) return null;

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
      <h2 className="mb-3 text-sm font-medium text-zinc-400">Fișiere sugerate</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {data.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setPreview(f)}
            // Prevent the browser's double-click text selection on the tile.
            onMouseDown={(e) => e.preventDefault()}
            title={f.name}
            className="flex min-w-0 select-none flex-col gap-2.5 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 text-left outline-none transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/70 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
          >
            <FileTypeIcon name={f.name} mime={f.mimeType} size="sm" />
            <span className="min-w-0 truncate text-[13px] font-medium text-zinc-200">
              {f.name}
            </span>
            <span className="-mt-1.5 truncate text-[11px] text-zinc-500">
              {fileTypeShort(f.name, f.mimeType)} · {formatBytes(f.size)}
            </span>
          </button>
        ))}
      </div>

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
