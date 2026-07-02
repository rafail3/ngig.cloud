"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Trash2, Loader2, X, Trash } from "lucide-react";
import {
  restoreFileAction,
  deleteFilePermanentlyAction,
  emptyTrashAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort } from "@/lib/format-date";
import { fileTypeShort } from "@/lib/file-type";
import { listContainer, listItem, ModalShell } from "./anim";
import { revalidateDrive } from "./useDriveData";

export type TrashFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  deletedAt: string;
  expiresInDays: number;
};

function expiryLabel(days: number): string {
  if (days <= 0) return "se șterge azi";
  if (days === 1) return "se șterge mâine";
  return `se șterge în ${days} zile`;
}

export function TrashList({ files }: { files: TrashFile[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TrashFile | null>(null);
  const [emptying, setEmptying] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handleRevoked(res: unknown): boolean {
    if (res && typeof res === "object" && "revoked" in res) {
      window.location.assign("/login");
      return true;
    }
    return false;
  }

  async function restore(file: TrashFile) {
    setBusyId(file.id);
    setErr(null);
    try {
      const res = await restoreFileAction(file.id);
      if (handleRevoked(res)) return;
      revalidateDrive();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(file: TrashFile) {
    setBusyId(file.id);
    setErr(null);
    try {
      const res = await deleteFilePermanentlyAction(file.id);
      if (handleRevoked(res)) return;
      setToDelete(null);
      revalidateDrive();
    } finally {
      setBusyId(null);
    }
  }

  async function empty() {
    setEmptying(true);
    setErr(null);
    try {
      const res = await emptyTrashAction();
      if (handleRevoked(res)) return;
      setConfirmEmpty(false);
      revalidateDrive();
    } finally {
      setEmptying(false);
    }
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
        <Trash className="h-7 w-7 text-zinc-600" />
        <p className="mt-3 text-base font-medium text-zinc-300">Coșul e gol</p>
        <p className="mt-1 text-sm text-zinc-500">
          Fișierele pe care le muți în coș apar aici.
        </p>
      </div>
    );
  }

  return (
    <>
      {err && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3.5 py-2 text-sm text-red-300">
          <span>{err}</span>
          <button
            type="button"
            onClick={() => setErr(null)}
            aria-label="Închide"
            className="shrink-0 rounded p-0.5 text-red-400 transition hover:text-red-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-500">
          {files.length} {files.length === 1 ? "fișier" : "fișiere"} în coș
        </span>
        <button
          type="button"
          onClick={() => setConfirmEmpty(true)}
          className="flex items-center gap-1.5 rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" />
          Golește coșul
        </button>
      </div>

      <motion.ul
        variants={listContainer}
        initial="hidden"
        animate="show"
        className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800"
      >
        <AnimatePresence initial={false}>
          {files.map((file) => {
            const busy = busyId === file.id;
            const soon = file.expiresInDays <= 3;
            return (
              <motion.li
                key={file.id}
                layout
                variants={listItem}
                exit={{ opacity: 0, scale: 0.97 }}
                style={{ opacity: busy ? 0.5 : 1 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-zinc-100">
                    {file.name}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {fileTypeShort(file.name, file.mimeType)} · {formatBytes(file.size)} ·
                    șters {formatDateShort(file.deletedAt)} ·{" "}
                    <span className={soon ? "text-amber-400" : undefined}>
                      {expiryLabel(file.expiresInDays)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin text-indigo-400" />}
                  <button
                    type="button"
                    onClick={() => restore(file)}
                    disabled={busy}
                    aria-label="Restaurează"
                    title="Restaurează"
                    className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(file)}
                    disabled={busy}
                    aria-label="Șterge definitiv"
                    title="Șterge definitiv"
                    className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      <AnimatePresence>
        {toDelete && (
          <ModalShell key="delete-one" onClose={() => setToDelete(null)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">
              Ștergi definitiv?
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              <span className="break-all font-medium text-zinc-300">{toDelete.name}</span>{" "}
              va fi șters permanent. Acțiunea e ireversibilă.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                disabled={busyId === toDelete.id}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => remove(toDelete)}
                disabled={busyId === toDelete.id}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-60"
              >
                {busyId === toDelete.id ? "Se șterge…" : "Șterge definitiv"}
              </button>
            </div>
          </ModalShell>
        )}

        {confirmEmpty && (
          <ModalShell key="empty" onClose={() => setConfirmEmpty(false)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">Golești coșul?</h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Toate cele{" "}
              <span className="font-medium text-zinc-300">{files.length}</span>{" "}
              {files.length === 1 ? "fișier" : "fișiere"} vor fi șterse definitiv.
              Acțiunea e ireversibilă.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEmpty(false)}
                disabled={emptying}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={empty}
                disabled={emptying}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-60"
              >
                {emptying ? "Se golește…" : "Golește coșul"}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </>
  );
}
