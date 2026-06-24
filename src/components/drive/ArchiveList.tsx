"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, Download, Trash2, Loader2, X } from "lucide-react";
import {
  unarchiveFileAction,
  getDownloadUrlAction,
  moveFileToTrashAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort } from "@/lib/format-date";
import { fileTypeShort } from "@/lib/file-type";
import { listContainer, listItem } from "./anim";
import { useContextMenu } from "./ContextMenu";
import { ActionMenu, type MenuAction } from "./ActionMenu";
import { PreviewModal, type PreviewFile } from "./PreviewModal";

export type ArchiveFile = PreviewFile & { archivedAt: string };

export function ArchiveList({ files }: { files: ArchiveFile[] }) {
  const router = useRouter();
  const openMenu = useContextMenu();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArchiveFile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleRevoked(res: unknown): boolean {
    if (res && typeof res === "object" && "revoked" in res) {
      window.location.assign("/login");
      return true;
    }
    return false;
  }

  async function download(id: string) {
    const res = await getDownloadUrlAction(id);
    if (typeof res !== "string") {
      window.location.assign("/login");
      return;
    }
    window.location.assign(res);
  }

  async function unarchive(file: ArchiveFile) {
    setBusyId(file.id);
    setErr(null);
    try {
      const res = await unarchiveFileAction(file.id);
      if (handleRevoked(res)) return;
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function trash(file: ArchiveFile) {
    setBusyId(file.id);
    setErr(null);
    try {
      const res = await moveFileToTrashAction(file.id);
      if (handleRevoked(res)) return;
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function actions(file: ArchiveFile): MenuAction[] {
    return [
      { icon: ArchiveRestore, label: "Dezarhivează", onSelect: () => unarchive(file) },
      { icon: Download, label: "Descarcă", onSelect: () => download(file.id) },
      { icon: Trash2, label: "Mută în coș", onSelect: () => trash(file), danger: true },
    ];
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
        <Archive className="h-7 w-7 text-zinc-600" />
        <p className="mt-3 text-base font-medium text-zinc-300">Arhiva e goală</p>
        <p className="mt-1 text-sm text-zinc-500">
          Fișierele pe care le arhivezi din drive apar aici.
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

      <p className="mb-3 text-sm text-zinc-500">
        {files.length} {files.length === 1 ? "fișier" : "fișiere"} în arhivă
      </p>

      <motion.ul
        variants={listContainer}
        initial="hidden"
        animate="show"
        className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800"
      >
        <AnimatePresence initial={false}>
          {files.map((file) => {
            const busy = busyId === file.id;
            return (
              <motion.li
                key={file.id}
                layout
                variants={listItem}
                exit={{ opacity: 0, scale: 0.97 }}
                style={{ opacity: busy ? 0.5 : 1 }}
                onClick={() => setPreview(file)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openMenu(actions(file), e.clientX, e.clientY);
                }}
                className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-zinc-100">
                    {file.name}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {fileTypeShort(file.name, file.mimeType)} · {formatBytes(file.size)} ·
                    arhivat {formatDateShort(file.archivedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin text-indigo-400" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      unarchive(file);
                    }}
                    disabled={busy}
                    aria-label="Dezarhivează"
                    title="Dezarhivează"
                    className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                  <ActionMenu actions={actions(file)} label="Opțiuni fișier" />
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      <AnimatePresence>
        {preview && (
          <PreviewModal
            key="preview"
            file={preview}
            onClose={() => setPreview(null)}
            onDownload={() => download(preview.id)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
