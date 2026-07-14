"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { revalidateDrive } from "@/components/drive/useDriveData";
import { useDraggable } from "@dnd-kit/core";
import {
  Loader2,
  Info,
  Download,
  Pencil,
  SquarePen,
  FolderInput,
  Copy,
  Archive,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDownloadUrlAction,
  renameFileAction,
  moveFileAction,
  copyFileAction,
  moveFileToTrashAction,
  archiveFileAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort, formatDateTime } from "@/lib/format-date";
import { fileTypeShort, fileTypeLabel, isTextEditable } from "@/lib/file-type";
import { useUploads, type UploadJob } from "./UploadProvider";
import { PreviewModal } from "./PreviewModal";
import { InfoModal } from "./InfoModal";
import { FolderPickerModal } from "./FolderPickerModal";
import { ActionMenu, type MenuAction } from "./ActionMenu";
import { useContextMenu } from "./ContextMenu";
import { useSelection, selKey, type SelItem } from "./SelectionProvider";
import { useLongPress } from "./useLongPress";
import { RenameModal } from "./RenameModal";
import { useMounted, useIsTouch, useRowClick } from "./anim";
import { useDragActive, usePendingMove, type DragData } from "./DriveDndProvider";
import { useFilter } from "./FilterProvider";

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
  updatedAt: string;
};

// A file counts as "modified" only once its content has actually changed
// (in-app editing) — updated_at moves past created_at. Rename/move don't.
function isModified(f: { createdAt: string; updatedAt: string }): boolean {
  return new Date(f.updatedAt).getTime() > new Date(f.createdAt).getTime();
}

export function FileList({ folderId }: { folderId: string | null }) {
  const { jobs } = useUploads();
  // `files` is filtered for display; `rawFiles` is the full set, used only to
  // tell when an upload's real row has arrived (so its ghost can disappear).
  const { files, rawFiles } = useFilter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileItem | null>(null);
  // True when the preview was opened straight into edit mode (Editează action).
  const [editIntent, setEditIntent] = useState(false);
  const [info, setInfo] = useState<FileItem | null>(null);
  const [toRename, setToRename] = useState<FileItem | null>(null);
  const [toMove, setToMove] = useState<FileItem | null>(null);

  // Rows shown above the stored files: in-flight uploads INTO THIS FOLDER, plus
  // just-finished ones whose real row hasn't arrived yet (bridges the brief gap
  // until router.refresh lands, so the ghost doesn't flicker out for a moment).
  const uploading = jobs.filter(
    (j) =>
      j.folderId === folderId &&
      (j.status === "uploading" ||
        j.status === "queued" ||
        (j.status === "done" &&
          !rawFiles.some((f) => f.name === j.name && f.size === j.size))),
  );

  async function download(id: string) {
    const res = await getDownloadUrlAction(id);
    if (typeof res !== "string") {
      window.location.assign("/login");
      return;
    }
    window.location.assign(res);
  }

  async function copy(file: FileItem) {
    setPendingId(file.id);
    try {
      const res = await copyFileAction(file.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      revalidateDrive();
    } finally {
      setPendingId(null);
    }
  }

  async function trash(file: FileItem) {
    setPendingId(file.id);
    try {
      const res = await moveFileToTrashAction(file.id);
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
      revalidateDrive();
    } finally {
      setPendingId(null);
    }
  }

  async function archive(file: FileItem) {
    setPendingId(file.id);
    try {
      const res = await archiveFileAction(file.id);
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
      revalidateDrive();
    } finally {
      setPendingId(null);
    }
  }

  if (files.length === 0 && uploading.length === 0) return null;

  return (
    <>
      {/* Fully static list — rows replace in place with no enter/exit animation.
          Opening a folder shows its files directly: no entrance slide, and no
          "ghost" of the previous folder's rows animating out over the new ones. */}
      <ul className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900">
          {uploading.map((job) => (
            <UploadingRow key={job.id} job={job} />
          ))}
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              folderId={folderId}
              pending={pendingId === f.id}
              onPreview={() => setPreview(f)}
              onEdit={() => {
                setEditIntent(true);
                setPreview(f);
              }}
              onInfo={() => setInfo(f)}
              onRename={() => setToRename(f)}
              onMove={() => setToMove(f)}
              onCopy={() => copy(f)}
              onArchive={() => archive(f)}
              onDownload={() => download(f.id)}
              onTrash={() => trash(f)}
            />
          ))}
      </ul>

      <AnimatePresence>
        {preview && (
          <PreviewModal
            key="preview"
            file={preview}
            startEditing={editIntent}
            onClose={() => {
              setPreview(null);
              setEditIntent(false);
            }}
            onDownload={() => download(preview.id)}
            onSaved={() => revalidateDrive()}
          />
        )}

        {info && (
          <InfoModal
            key="info"
            title={info.name}
            onClose={() => setInfo(null)}
            rows={[
              { label: "Dimensiune", value: formatBytes(info.size) },
              { label: "Tip", value: fileTypeLabel(info.name, info.mimeType) },
              { label: "Încărcat", value: formatDateTime(info.createdAt) },
              ...(isModified(info)
                ? [{ label: "Modificat", value: formatDateTime(info.updatedAt) }]
                : []),
            ]}
          />
        )}

        {toRename && (
          <RenameModal
            key="rename"
            title="Redenumește fișierul"
            initialName={toRename.name}
            keepExtension
            onClose={() => setToRename(null)}
            onRename={async (name) => {
              const res = await renameFileAction(toRename.id, name);
              if (!res.error) {
                setToRename(null);
                revalidateDrive();
              }
              return res;
            }}
          />
        )}

        {toMove && (
          <FolderPickerModal
            key="move"
            title={`Mută „${toMove.name}”`}
            onClose={() => setToMove(null)}
            onPick={async (dest) => {
              const res = await moveFileAction(toMove.id, dest);
              if (!res.error) {
                setToMove(null);
                revalidateDrive();
              }
              return res;
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FileRow({
  file,
  folderId,
  pending,
  onPreview,
  onEdit,
  onInfo,
  onRename,
  onMove,
  onCopy,
  onArchive,
  onDownload,
  onTrash,
}: {
  file: FileItem;
  folderId: string | null;
  pending: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onInfo: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onArchive: () => void;
  onDownload: () => void;
  onTrash: () => void;
}) {
  const openMenu = useContextMenu();
  const selection = useSelection();
  const mounted = useMounted();
  const isTouch = useIsTouch();
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: `file:${file.id}`,
    data: { kind: "file", id: file.id, name: file.name, parentId: folderId } satisfies DragData,
  });

  const item: SelItem = {
    kind: "file",
    id: file.id,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    createdAt: file.createdAt,
  };
  const selected = selection.isSelected(selKey(item));
  // Dim from OUR own drag context (cleared reliably on drag end); dnd-kit's
  // isDragging can stick "true" after a drop-in-place in this setup.
  const dragActive = useDragActive();
  const dimmed = dragActive?.kind === "file" && dragActive.id === file.id;
  const moving = usePendingMove().has(selKey(item));
  const busy = pending || moving;
  const longPress = useLongPress(() => selection.toggle(item));
  const handleRowClick = useRowClick({
    isTouch,
    onSelect: (mods) => selection.handleClick(item, mods),
    onOpen: onPreview,
  });

  const actions: MenuAction[] = [
    { icon: Download, label: "Descarcă", onSelect: onDownload },
    ...(isTextEditable(file.name, file.mimeType)
      ? [{ icon: SquarePen, label: "Editează", onSelect: onEdit }]
      : []),
    { icon: Pencil, label: "Redenumește", onSelect: onRename },
    { icon: FolderInput, label: "Mută", onSelect: onMove },
    { icon: Copy, label: "Copiază", onSelect: onCopy },
    { icon: Archive, label: "Arhivează", onSelect: onArchive },
    { icon: Info, label: "Detalii", onSelect: onInfo },
    { icon: Trash2, label: "Mută în coș", onSelect: onTrash, danger: true },
  ];

  return (
    <motion.li
      ref={setNodeRef}
      {...(mounted ? attributes : {})}
      {...(mounted ? listeners : {})}
      {...longPress.handlers}
      data-drive-item
      onClick={(e) => {
        if (longPress.consumedClick()) return;
        handleRowClick(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(actions, e.clientX, e.clientY);
      }}
      // Use 1 (not undefined) for the normal state: framer-motion doesn't reset
      // opacity when the style prop becomes undefined, which left a stuck ghost.
      style={{ opacity: dimmed ? 0.4 : busy ? 0.5 : 1 }}
      className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
        selected ? "bg-indigo-500/10" : "hover:bg-zinc-900/40"
      }`}
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-base font-medium text-zinc-100">{file.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-zinc-500">
          <span className="truncate">
            {fileTypeShort(file.name, file.mimeType)} · {formatBytes(file.size)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex shrink-0 items-center gap-1" title="Data încărcării">
            <Upload className="h-3 w-3" aria-hidden="true" />
            {formatDateShort(file.createdAt)}
          </span>
          {isModified(file) && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className="flex shrink-0 items-center gap-1"
                title="Data modificării"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                {formatDateShort(file.updatedAt)}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin text-indigo-400" />}
        <ActionMenu actions={actions} label="Opțiuni fișier" />
      </div>
    </motion.li>
  );
}
