"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Trash2, Loader2, Info, Download } from "lucide-react";
import { getDownloadUrlAction, deleteFileAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort, formatDateTime } from "@/lib/format-date";
import { useUploads, type UploadJob } from "./UploadProvider";
import { PreviewModal } from "./PreviewModal";
import { InfoModal } from "./InfoModal";
import { ModalShell, listContainer, listItem } from "./anim";

function speedLabel(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

function etaLabel(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// A row for a file that is still uploading, shown in-place above the real files.
function UploadingRow({ job }: { job: UploadJob }) {
  const pct = job.size > 0 ? Math.min(100, Math.round((job.sent / job.size) * 100)) : 0;
  return (
    <motion.li
      layout
      variants={listItem}
      exit={{ opacity: 0, scale: 0.97 }}
      className="px-4 py-3 opacity-55"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />
          <p className="truncate text-base font-medium text-zinc-200">{job.name}</p>
        </div>
        <span className="shrink-0 text-sm text-zinc-500">
          {job.status === "queued"
            ? "În așteptare"
            : job.status === "done"
              ? "Finalizare…"
              : `${speedLabel(job.speed)} · ${etaLabel(job.etaSec)}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {pct}% · {formatBytes(job.sent)} / {formatBytes(job.size)}
      </p>
    </motion.li>
  );
}

type FileItem = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
};

export function FileList({
  files,
  folderId,
}: {
  files: FileItem[];
  folderId: string | null;
}) {
  const router = useRouter();
  const { jobs } = useUploads();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FileItem | null>(null);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [info, setInfo] = useState<FileItem | null>(null);

  // Rows shown above the stored files: in-flight uploads INTO THIS FOLDER, plus
  // just-finished ones whose real row hasn't arrived yet (bridges the brief gap
  // until router.refresh lands, so the ghost doesn't flicker out for a moment).
  const uploading = jobs.filter(
    (j) =>
      j.folderId === folderId &&
      (j.status === "uploading" ||
        j.status === "queued" ||
        (j.status === "done" &&
          !files.some((f) => f.name === j.name && f.size === j.size))),
  );

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

  if (files.length === 0 && uploading.length === 0) return null;

  return (
    <>
      <motion.ul
        variants={listContainer}
        initial="hidden"
        animate="show"
        className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900"
      >
        <AnimatePresence initial={false}>
          {uploading.map((job) => (
            <UploadingRow key={job.id} job={job} />
          ))}
          {files.map((f) => (
            <motion.li
              key={f.id}
              layout
              variants={listItem}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/40"
            >
              <button
                type="button"
                onClick={() => setPreview(f)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-base font-medium text-zinc-100">{f.name}</p>
                <p className="text-sm text-zinc-500">
                  {formatBytes(f.size)} · {formatDateShort(f.createdAt)}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInfo(f)}
                  aria-label="Detalii"
                  className="rounded-md border border-zinc-800 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-50"
                >
                  <Info className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => download(f.id)}
                  aria-label="Descarcă"
                  className="rounded-md border border-zinc-800 p-2 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(f)}
                  disabled={pendingId === f.id}
                  aria-label="Șterge"
                  className="rounded-md border border-red-900/60 p-2 text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50"
                >
                  {pendingId === f.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <AnimatePresence>
        {toDelete && (
          <ConfirmDeleteModal
            key="delete"
            name={toDelete.name}
            onCancel={() => setToDelete(null)}
            onConfirm={confirmDelete}
          />
        )}

        {preview && (
          <PreviewModal
            key="preview"
            file={preview}
            onClose={() => setPreview(null)}
            onDownload={() => download(preview.id)}
          />
        )}

        {info && (
          <InfoModal
            key="info"
            title={info.name}
            onClose={() => setInfo(null)}
            rows={[
              { label: "Dimensiune", value: formatBytes(info.size) },
              { label: "Tip", value: info.mimeType ?? "necunoscut" },
              { label: "Încărcat", value: formatDateTime(info.createdAt) },
            ]}
          />
        )}
      </AnimatePresence>
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
  return (
    <ModalShell onClose={onCancel}>
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
          className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500"
        >
          Șterge
        </button>
      </div>
    </ModalShell>
  );
}
