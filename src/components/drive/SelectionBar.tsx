"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { revalidateDrive } from "@/components/drive/useDriveData";
import { Archive, Copy, Download, FolderInput, Info, Pencil, Share2, SquarePen, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  getDownloadUrlAction,
  moveFileAction,
  moveFolderAction,
  moveFileToTrashAction,
  deleteFolderAction,
  renameFileAction,
  renameFolderAction,
  copyFileAction,
  archiveFileAction,
  folderStatsAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/format-date";
import { fileTypeLabel, isTextEditable } from "@/lib/file-type";
import { isOfficeEditable, officeCanEdit, officeEditUnavailable } from "@/lib/office";
import { useSelection, type SelItem } from "./SelectionProvider";
import { useOfficeStatus } from "./OfficeStatusProvider";
import { FolderPickerModal } from "./FolderPickerModal";
import { RenameModal } from "./RenameModal";
import { ShareModal } from "./ShareModal";
import { InfoModal } from "./InfoModal";
import { OfficeEditor } from "./OfficeEditor";
import { PreviewModal, type PreviewFile } from "./PreviewModal";
import { ModalShell } from "./anim";

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type BarAction = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

/* Action bar shown while items are selected (under the upload area). With a
   single item it offers the full per-item actions (like the desktop right-click
   menu); with several it offers the bulk actions (move / download / delete). On
   mobile this is the only action surface — selection is entered by long-press. */
export function SelectionBar() {
  const { selected, count, clear } = useSelection();
  const [moving, setMoving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [renaming, setRenaming] = useState<SelItem | null>(null);
  const [sharing, setSharing] = useState<SelItem[] | null>(null);
  const [infoItem, setInfoItem] = useState<SelItem | null>(null);
  const [folderStats, setFolderStats] = useState<{ size: number; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Editing opened straight from the bar: Office docs go to the OnlyOffice
  // editor, plain text to the in-app one (via the preview's edit mode).
  const [officeFile, setOfficeFile] = useState<SelItem | null>(null);
  const [textFile, setTextFile] = useState<PreviewFile | null>(null);

  const officeStatus = useOfficeStatus();
  const items = [...selected.values()];
  const single = count === 1 ? items[0] : null;
  const editableSingle =
    single?.kind === "file" &&
    (officeCanEdit(officeStatus, single.name) ||
      isTextEditable(single.name, single.mimeType));

  function editSingle() {
    if (single?.kind !== "file") return;
    if (isOfficeEditable(single.name)) {
      // Offered but the server is down (onlyoffice-only mode): say so cleanly.
      if (officeEditUnavailable(officeStatus, single.name)) {
        toast.error(
          "Serviciul de editare e temporar indisponibil. Revine în scurt timp.",
        );
        return;
      }
      setOfficeFile(single);
      return;
    }
    const now = new Date().toISOString();
    setTextFile({
      id: single.id,
      name: single.name,
      size: single.size ?? 0,
      mimeType: single.mimeType ?? null,
      createdAt: single.createdAt ?? now,
      updatedAt: single.updatedAt ?? single.createdAt ?? now,
    });
  }
  const folderCount = items.filter((i) => i.kind === "folder").length;

  // Fetch folder stats when opening Info for a single folder. (folderStats is
  // reset to null by the action that opens Info, so no setState in the effect body.)
  useEffect(() => {
    if (infoItem?.kind !== "folder") return;
    folderStatsAction(infoItem.id).then((res) => {
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setFolderStats(res);
    });
  }, [infoItem]);

  async function bulkMove(dest: string | null): Promise<{ error?: string }> {
    setBusy(true);
    let error: string | undefined;
    for (const it of items) {
      const res =
        it.kind === "file"
          ? await moveFileAction(it.id, dest)
          : await moveFolderAction(it.id, dest);
      if (res.error) error = res.error;
    }
    setBusy(false);
    if (!error) {
      setMoving(false);
      clear();
      revalidateDrive();
    }
    return { error };
  }

  async function bulkDelete() {
    setBusy(true);
    for (const it of items) {
      const res =
        it.kind === "file"
          ? await moveFileToTrashAction(it.id)
          : await deleteFolderAction(it.id);
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
    }
    setBusy(false);
    setConfirmDel(false);
    clear();
    revalidateDrive();
  }

  // Files only go to the (reversible) trash → act straight away, like the
  // right-click menu. Folders are deleted permanently → confirm first.
  function requestDelete() {
    if (folderCount > 0) setConfirmDel(true);
    else bulkDelete();
  }

  async function downloadSelection() {
    for (const it of items) {
      if (it.kind === "file") {
        const url = await getDownloadUrlAction(it.id);
        if (typeof url === "string") triggerDownload(url);
        else {
          window.location.assign("/login");
          return;
        }
      } else {
        triggerDownload(`/api/folder/${it.id}/download`);
      }
      await delay(400); // stagger so the browser doesn't drop downloads
    }
  }

  async function copySingle() {
    if (!single) return;
    setBusy(true);
    const res = await copyFileAction(single.id);
    setBusy(false);
    if (!res.error) {
      clear();
      revalidateDrive();
    }
  }

  // Archive the file(s) in the selection (folders aren't archivable, skipped).
  async function archiveSelection() {
    setBusy(true);
    for (const it of items) {
      if (it.kind !== "file") continue;
      const res = await archiveFileAction(it.id);
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
    }
    setBusy(false);
    clear();
    revalidateDrive();
  }

  // Per-item actions for a single selection, mirroring the desktop context menu.
  const singleActions: BarAction[] = single
    ? [
        { icon: Download, label: "Descarcă", onClick: downloadSelection },
        { icon: Share2, label: "Partajează", onClick: () => setSharing([single]) },
        { icon: Pencil, label: "Redenumește", onClick: () => setRenaming(single) },
        { icon: FolderInput, label: "Mută", onClick: () => setMoving(true) },
        ...(single.kind === "file"
          ? [
              { icon: Copy, label: "Copiază", onClick: copySingle },
              // Editing earns the slot when the file supports it; archiving is
              // the rarer action and stays one click away in the kebab menu.
              editableSingle
                ? { icon: SquarePen, label: "Editează", onClick: editSingle }
                : { icon: Archive, label: "Arhivează", onClick: archiveSelection },
            ]
          : []),
        {
          icon: Info,
          label: "Detalii",
          onClick: () => {
            setFolderStats(null);
            setInfoItem(single);
          },
        },
        {
          icon: Trash2,
          label: single.kind === "file" ? "Mută în coș" : "Șterge",
          onClick: requestDelete,
          danger: true,
        },
      ]
    : [];

  const bulkActions: BarAction[] = [
    { icon: Download, label: "Descarcă", onClick: downloadSelection },
    { icon: Share2, label: "Partajează", onClick: () => setSharing(items) },
    { icon: FolderInput, label: "Mută", onClick: () => setMoving(true) },
    // Archive only when the selection is files-only (folders aren't archivable).
    ...(folderCount === 0
      ? [{ icon: Archive, label: "Arhivează", onClick: archiveSelection }]
      : []),
    {
      icon: Trash2,
      label: folderCount > 0 ? "Șterge" : "Mută în coș",
      onClick: requestDelete,
      danger: true,
    },
  ];

  const actions = single ? singleActions : bulkActions;

  return (
    <>
      {officeFile && (
        <OfficeEditor
          fileId={officeFile.id}
          name={officeFile.name}
          onClose={() => setOfficeFile(null)}
        />
      )}

      <AnimatePresence>
        {textFile && (
          <PreviewModal
            key="edit"
            file={textFile}
            startEditing
            onClose={() => setTextFile(null)}
            onDownload={downloadSelection}
            onSaved={() => revalidateDrive()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.div
            data-keep-selection
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            // Floats over the content (fixed) instead of sitting in the flow, so
            // selecting never pushes the list down — selection is instant and
            // double-click stays reliable.
            className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
          >
            <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-indigo-500/40 bg-zinc-900/95 px-4 py-2.5 shadow-2xl shadow-black/40 backdrop-blur">
              <button
                type="button"
                onClick={clear}
                aria-label="Anulează selecția"
                className="rounded-md p-1 text-zinc-300 transition hover:bg-zinc-50/10 hover:text-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-zinc-100">
                {count} {count === 1 ? "selectat" : "selectate"}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {actions.map((a) => (
                  <BarButton key={a.label} action={a} disabled={busy} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moving && (
          <FolderPickerModal
            key="bulk-move"
            title={single ? `Mută „${single.name}”` : `Mută ${count} elemente`}
            onClose={() => setMoving(false)}
            onPick={bulkMove}
          />
        )}

        {sharing && (
          <ShareModal
            key="share"
            targets={sharing.map((i) => ({
              type: i.kind,
              id: i.id,
              name: i.name,
            }))}
            onClose={() => setSharing(null)}
          />
        )}

        {renaming && (
          <RenameModal
            key="rename"
            title={renaming.kind === "file" ? "Redenumește fișierul" : "Redenumește folderul"}
            initialName={renaming.name}
            keepExtension={renaming.kind === "file"}
            onClose={() => setRenaming(null)}
            onRename={async (name) => {
              const res =
                renaming.kind === "file"
                  ? await renameFileAction(renaming.id, name)
                  : await renameFolderAction(renaming.id, name);
              if (!res.error) {
                setRenaming(null);
                clear();
                revalidateDrive();
              }
              return res;
            }}
          />
        )}

        {infoItem && (
          <InfoModal
            key="info"
            title={infoItem.name}
            onClose={() => setInfoItem(null)}
            rows={
              infoItem.kind === "file"
                ? [
                    { label: "Dimensiune", value: formatBytes(infoItem.size ?? 0) },
                    { label: "Tip", value: fileTypeLabel(infoItem.name, infoItem.mimeType) },
                    {
                      label: "Încărcat",
                      value: infoItem.createdAt ? formatDateTime(infoItem.createdAt) : "—",
                    },
                  ]
                : [
                    { label: "Fișiere", value: folderStats ? String(folderStats.count) : "…" },
                    {
                      label: "Dimensiune totală",
                      value: folderStats ? formatBytes(folderStats.size) : "…",
                    },
                  ]
            }
          />
        )}

        {confirmDel && (
          <ModalShell key="bulk-delete" onClose={() => setConfirmDel(false)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">
              {single ? `Ștergi „${single.name}”?` : `Ștergi ${count} elemente?`}
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Fișierele merg în coș (recuperabile).
              {folderCount > 0 && (
                <>
                  {" "}
                  <span className="font-medium text-zinc-300">
                    {folderCount} {folderCount === 1 ? "folder" : "foldere"}
                  </span>{" "}
                  și tot ce conțin vor fi șterse definitiv.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                disabled={busy}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-60"
              >
                {busy ? "Se șterge…" : "Șterge"}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </>
  );
}

function BarButton({ action, disabled }: { action: BarAction; disabled?: boolean }) {
  const { icon: Icon, label, onClick, danger } = action;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      // Icon-only on mobile so the whole bar fits one thumb-friendly row; the
      // labels return from sm: up.
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition disabled:opacity-50 sm:px-3 sm:py-1.5 ${
        danger
          ? "border-red-900/60 text-red-300 hover:bg-red-950/40"
          : "border-zinc-700 text-zinc-200 hover:bg-zinc-50/10"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
