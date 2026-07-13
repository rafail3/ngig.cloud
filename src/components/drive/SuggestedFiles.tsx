"use client";

import { useState } from "react";
import { File as FileIcon } from "lucide-react";
import { useSuggested } from "./useDriveData";
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
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Fișiere sugerate
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {data.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setPreview(f)}
            title={f.name}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-left outline-none transition hover:border-zinc-700 hover:bg-zinc-900/70 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
          >
            <FileIcon className="h-5 w-5 shrink-0 text-indigo-400" />
            <span className="min-w-0 truncate text-sm text-zinc-200">{f.name}</span>
            <span className="truncate text-xs text-zinc-500">
              {fileTypeShort(f.mimeType ?? "", f.name)} · {formatBytes(f.size)}
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
