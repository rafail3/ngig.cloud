"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getDownloadUrlAction, deleteFileAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort } from "@/lib/format-date";

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
  const [toDelete, setToDelete] = useState<FileItem | null>(null);

  async function download(id: string) {
    const res = await getDownloadUrlAction(id);
    if (typeof res !== "string") {
      window.location.assign("/login");
      return;
    }
    window.location.assign(res);
  }

  async function confirmDelete() {
    const file = toDelete;
    if (!file) return;
    setToDelete(null);
    setPendingId(file.id);
    try {
      const res = await deleteFileAction(file.id);
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
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
    <>
      <ul className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-900/40"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-zinc-100">{f.name}</p>
              <p className="text-sm text-zinc-500">
                {formatBytes(f.size)} · {formatDateShort(f.createdAt)}
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
                onClick={() => setToDelete(f)}
                disabled={pendingId === f.id}
                className="rounded-md border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50"
              >
                {pendingId === f.id ? "…" : "Șterge"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {toDelete && (
        <ConfirmDeleteModal
          name={toDelete.name}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}

function ConfirmDeleteModal({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">Ștergi fișierul?</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          <span className="break-all font-medium text-zinc-300">{name}</span> va fi șters definitiv.
          Acțiunea e ireversibilă.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Șterge
          </button>
        </div>
      </div>
    </div>
  );
}
