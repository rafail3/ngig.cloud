"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useDraggable } from "@dnd-kit/core";
import {
  Loader2,
  Info,
  Download,
  Pencil,
  FolderInput,
  Copy,
  Trash2,
  X,
} from "lucide-react";
import {
  getDownloadUrlAction,
  renameFileAction,
  moveFileAction,
  copyFileAction,
  moveFileToTrashAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort, formatDateTime } from "@/lib/format-date";
import { useUploads, type UploadJob } from "./UploadProvider";
import { PreviewModal } from "./PreviewModal";
import { InfoModal } from "./InfoModal";
import { FolderPickerModal } from "./FolderPickerModal";
import { ActionMenu, type MenuAction } from "./ActionMenu";
import { useContextMenu } from "./ContextMenu";
import { useSelection, selKey, type SelItem } from "./SelectionProvider";
import { SelectCheckbox } from "./SelectCheckbox";
import { useLongPress } from "./useLongPress";
import { RenameModal } from "./RenameModal";
import { listContainer, listItem, useMounted } from "./anim";
import { useDragActive, usePendingMove, type DragData } from "./DriveDndProvider";

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
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [info, setInfo] = useState<FileItem | null>(null);
  const [toRename, setToRename] = useState<FileItem | null>(null);
  const [toMove, setToMove] = useState<FileItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  async function copy(file: FileItem) {
    setPendingId(file.id);
    setErr(null);
    try {
      const res = await copyFileAction(file.id);
      if (res.error) {
        setErr(res.error);
        return;
      }
      router.refresh();
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
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (files.length === 0 && uploading.length === 0) return null;

  return (
    <>
      {err && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3.5 py-2 text-sm text-red-300">
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
            <FileRow
              key={f.id}
              file={f}
              folderId={folderId}
              pending={pendingId === f.id}
              onPreview={() => setPreview(f)}
              onInfo={() => setInfo(f)}
              onRename={() => setToRename(f)}
              onMove={() => setToMove(f)}
              onCopy={() => copy(f)}
              onDownload={() => download(f.id)}
              onTrash={() => trash(f)}
            />
          ))}
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

        {toRename && (
          <RenameModal
            key="rename"
            title="Redenumește fișierul"
            initialName={toRename.name}
            onClose={() => setToRename(null)}
            onRename={async (name) => {
              const res = await renameFileAction(toRename.id, name);
              if (!res.error) {
                setToRename(null);
                router.refresh();
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
                router.refresh();
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
  onInfo,
  onRename,
  onMove,
  onCopy,
  onDownload,
  onTrash,
}: {
  file: FileItem;
  folderId: string | null;
  pending: boolean;
  onPreview: () => void;
  onInfo: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onTrash: () => void;
}) {
  const openMenu = useContextMenu();
  const selection = useSelection();
  const mounted = useMounted();
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
  const dragActive = useDragActive();
  const dimmed = dragActive?.kind === "file" && dragActive.id === file.id;
  const moving = usePendingMove().has(selKey(item));
  const busy = pending || moving;
  const longPress = useLongPress(() => selection.toggle(item));

  const actions: MenuAction[] = [
    { icon: Download, label: "Descarcă", onSelect: onDownload },
    { icon: Pencil, label: "Redenumește", onSelect: onRename },
    { icon: FolderInput, label: "Mută", onSelect: onMove },
    { icon: Copy, label: "Copiază", onSelect: onCopy },
    { icon: Info, label: "Detalii", onSelect: onInfo },
    { icon: Trash2, label: "Mută în coș", onSelect: onTrash, danger: true },
  ];

  return (
    <motion.li
      ref={setNodeRef}
      {...(mounted ? attributes : {})}
      {...(mounted ? listeners : {})}
      {...longPress.handlers}
      layout
      variants={listItem}
      exit={{ opacity: 0, scale: 0.97 }}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(actions, e.clientX, e.clientY);
      }}
      style={{ opacity: dimmed ? 0.4 : busy ? 0.5 : undefined }}
      className={`group flex items-center gap-3 px-4 py-3 transition-colors ${
        selected ? "bg-indigo-500/10" : "hover:bg-zinc-900/40"
      }`}
    >
      <SelectCheckbox
        selected={selected}
        show={selected || selection.count > 0}
        onToggle={() => selection.toggle(item)}
      />
      <button
        type="button"
        onClick={(e) => {
          if (longPress.consumedClick()) return;
          if (selection.handleClick(item, e)) return;
          onPreview();
        }}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-base font-medium text-zinc-100">{file.name}</p>
        <p className="text-sm text-zinc-500">
          {formatBytes(file.size)} · {formatDateShort(file.createdAt)}
        </p>
      </button>
      <div className="flex shrink-0 items-center">
        {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin text-indigo-400" />}
        <ActionMenu actions={actions} label="Opțiuni fișier" />
      </div>
    </motion.li>
  );
}
