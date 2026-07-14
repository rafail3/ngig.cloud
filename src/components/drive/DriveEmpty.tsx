"use client";

import { FolderOpen } from "lucide-react";
import { useUploads } from "./UploadProvider";

// Empty-folder hint, hidden while something is uploading into this folder (the
// ghost rows in FileList cover that case).
export function DriveEmpty({ folderId }: { folderId: string | null }) {
  const { jobs } = useUploads();
  const busy = jobs.some(
    (j) =>
      j.folderId === folderId &&
      (j.status === "uploading" || j.status === "queued" || j.status === "done"),
  );
  if (busy) return null;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
        <FolderOpen className="h-5 w-5 text-zinc-500" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-300">Nimic aici încă</p>
        <p className="mt-1 text-sm text-zinc-500">
          Trage fișiere în zona de mai sus, ori creează un folder nou.
        </p>
      </div>
    </div>
  );
}
