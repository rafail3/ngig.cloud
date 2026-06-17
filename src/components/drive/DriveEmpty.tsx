"use client";

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
    <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center text-base text-zinc-500">
      Gol aici. Încarcă fișiere sau foldere, ori creează un folder nou.
    </div>
  );
}
