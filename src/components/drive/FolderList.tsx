"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder, Trash2 } from "lucide-react";
import { deleteFolderAction } from "@/app/drive-actions";

export type FolderItem = { id: string; name: string };

export function FolderList({ folders }: { folders: FolderItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FolderItem | null>(null);

  async function confirmDelete() {
    const folder = toDelete;
    if (!folder) return;
    setToDelete(null);
    setPendingId(folder.id);
    try {
      const res = await deleteFolderAction(folder.id);
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (folders.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {folders.map((f) => (
          <li
            key={f.id}
            className="flex min-h-[66px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
          >
            <Link
              href={`/?folder=${f.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Folder className="h-7 w-7 shrink-0 text-indigo-400" />
              <span className="truncate text-lg font-medium text-zinc-100">
                {f.name}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setToDelete(f)}
              disabled={pendingId === f.id}
              aria-label="Șterge folderul"
              className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {toDelete && (
        <ConfirmDeleteFolder
          name={toDelete.name}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}

function ConfirmDeleteFolder({
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
        <h3 className="mt-4 text-base font-semibold text-zinc-100">Ștergi folderul?</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          <span className="break-all font-medium text-zinc-300">{name}</span> și{" "}
          <span className="font-medium text-zinc-300">tot ce conține</span> vor fi
          șterse definitiv. Acțiunea e ireversibilă.
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
            className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500"
          >
            Șterge
          </button>
        </div>
      </div>
    </div>
  );
}
