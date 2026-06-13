"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDownloadUrlAction, deleteFileAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";

type FileItem = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
};

export function FileList({ files }: { files: FileItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function download(id: string) {
    const url = await getDownloadUrlAction(id);
    window.location.assign(url);
  }

  async function remove(id: string) {
    if (!confirm("Ștergi acest fișier? Acțiunea e ireversibilă.")) return;
    setPendingId(id);
    try {
      await deleteFileAction(id);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center text-base text-zinc-500">
        Niciun fișier încă. Apasă <span className="text-zinc-300">Upload</span> ca să adaugi.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900">
      {files.map((f) => (
        <li
          key={f.id}
          className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-900/40"
        >
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-zinc-100">{f.name}</p>
            <p className="text-sm text-zinc-500">
              {formatBytes(f.size)} · {new Date(f.createdAt).toLocaleDateString("ro-RO")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => download(f.id)}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => remove(f.id)}
              disabled={pendingId === f.id}
              className="rounded-md border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50"
            >
              {pendingId === f.id ? "…" : "Șterge"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
