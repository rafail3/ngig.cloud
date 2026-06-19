"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Folder, Trash2, Download, Info, Pencil, FolderInput } from "lucide-react";
import {
  deleteFolderAction,
  renameFolderAction,
  moveFolderAction,
  folderStatsAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { InfoModal } from "./InfoModal";
import { ActionMenu, type MenuAction } from "./ActionMenu";
import { useContextMenu } from "./ContextMenu";
import { FolderPickerModal } from "./FolderPickerModal";
import { ModalShell, listContainer, listItem, useMounted } from "./anim";
import type { DragData, DropData } from "./DriveDndProvider";

export type FolderItem = { id: string; name: string };

export function FolderList({
  folders,
  folderId,
}: {
  folders: FolderItem[];
  folderId: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FolderItem | null>(null);
  const [toRename, setToRename] = useState<FolderItem | null>(null);
  const [toMove, setToMove] = useState<FolderItem | null>(null);
  const [info, setInfo] = useState<FolderItem | null>(null);
  const [stats, setStats] = useState<{ size: number; count: number } | null>(null);

  function openInfo(folder: FolderItem) {
    setInfo(folder);
    setStats(null);
    folderStatsAction(folder.id).then((res) => {
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setStats(res);
    });
  }

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
      <motion.ul
        variants={listContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        <AnimatePresence initial={false}>
          {folders.map((f) => (
            <FolderCard
              key={f.id}
              folder={f}
              parentId={folderId}
              pending={pendingId === f.id}
              onDownload={() => window.location.assign(`/api/folder/${f.id}/download`)}
              onInfo={() => openInfo(f)}
              onRename={() => setToRename(f)}
              onMove={() => setToMove(f)}
              onDelete={() => setToDelete(f)}
            />
          ))}
        </AnimatePresence>
      </motion.ul>

      <AnimatePresence>
        {info && (
          <InfoModal
            key="info"
            title={info.name}
            onClose={() => setInfo(null)}
            rows={[
              { label: "Fișiere", value: stats ? String(stats.count) : "…" },
              {
                label: "Dimensiune totală",
                value: stats ? formatBytes(stats.size) : "…",
              },
            ]}
          />
        )}

        {toRename && (
          <RenameFolderModal
            key="rename"
            folder={toRename}
            onClose={() => setToRename(null)}
            onRenamed={() => {
              setToRename(null);
              router.refresh();
            }}
          />
        )}

        {toMove && (
          <FolderPickerModal
            key="move"
            title={`Mută „${toMove.name}”`}
            excludeSubtreeOf={toMove.id}
            onClose={() => setToMove(null)}
            onPick={async (dest) => {
              const res = await moveFolderAction(toMove.id, dest);
              if (!res.error) {
                setToMove(null);
                router.refresh();
              }
              return res;
            }}
          />
        )}

        {toDelete && (
          <ConfirmDeleteFolder
            key="delete"
            name={toDelete.name}
            onCancel={() => setToDelete(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FolderCard({
  folder,
  parentId,
  pending,
  onDownload,
  onInfo,
  onRename,
  onMove,
  onDelete,
}: {
  folder: FolderItem;
  parentId: string | null;
  pending: boolean;
  onDownload: () => void;
  onInfo: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const openMenu = useContextMenu();
  const mounted = useMounted();

  // Draggable (to move it) and droppable (drop another item into it) at once.
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: `folder:${folder.id}`,
    data: { kind: "folder", id: folder.id, name: folder.name, parentId } satisfies DragData,
  });
  const { setNodeRef: setDropRef, isOver, active } = useDroppable({
    id: `drop-folder:${folder.id}`,
    data: { destFolderId: folder.id } satisfies DropData,
  });
  const setRef = (el: HTMLLIElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };
  const activeData = active?.data.current as DragData | undefined;
  // Don't highlight a folder as a drop target for itself.
  const canDrop = !!activeData && !(activeData.kind === "folder" && activeData.id === folder.id);
  const highlight = isOver && canDrop;

  const actions: MenuAction[] = [
    { icon: Download, label: "Descarcă", onSelect: onDownload },
    { icon: Info, label: "Detalii", onSelect: onInfo },
    { icon: Pencil, label: "Redenumește", onSelect: onRename },
    { icon: FolderInput, label: "Mută", onSelect: onMove },
    { icon: Trash2, label: "Șterge", onSelect: onDelete, danger: true },
  ];

  return (
    <motion.li
      ref={setRef}
      {...(mounted ? attributes : {})}
      {...(mounted ? listeners : {})}
      layout
      variants={listItem}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      onClick={() => router.push(`/?folder=${folder.id}`)}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(actions, e.clientX, e.clientY);
      }}
      style={{ opacity: isDragging ? 0.4 : undefined }}
      className={`flex min-h-[66px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 transition-colors ${
        highlight
          ? "border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/60"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
      } ${pending ? "opacity-50" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Folder className="h-5 w-5 shrink-0 text-indigo-400" />
        <span className="truncate text-sm font-medium text-zinc-100">{folder.name}</span>
      </div>
      <ActionMenu actions={actions} label="Opțiuni folder" />
    </motion.li>
  );
}

function RenameFolderModal({
  folder,
  onClose,
  onRenamed,
}: {
  folder: FolderItem;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await renameFolderAction(folder.id, name);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onRenamed();
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="text-base font-semibold text-zinc-100">Redenumește folderul</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-3 w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Anulează
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60"
          >
            {busy ? "Se salvează…" : "Salvează"}
          </button>
        </div>
      </form>
    </ModalShell>
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
  return (
    <ModalShell onClose={onCancel}>
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
    </ModalShell>
  );
}
