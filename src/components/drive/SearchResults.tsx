"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Loader2,
  Folder,
  Search,
  Home,
  ChevronRight,
  Download,
  Pencil,
  SquarePen,
  FolderInput,
  Copy,
  Info,
  Trash2,
} from "lucide-react";
import {
  searchDriveAction,
  getDownloadUrlAction,
  renameFileAction,
  moveFileAction,
  copyFileAction,
  moveFileToTrashAction,
  renameFolderAction,
  moveFolderAction,
  deleteFolderAction,
  folderStatsAction,
} from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort, formatDateTime } from "@/lib/format-date";
import { fileTypeShort, fileTypeLabel, isTextEditable } from "@/lib/file-type";
import { fuzzyScore } from "@/lib/fuzzy";
import { useFilter, fileMatchesFilters } from "./FilterProvider";
import { listContainer, listItem } from "./anim";
import { useContextMenu } from "./ContextMenu";
import { ActionMenu, type MenuAction } from "./ActionMenu";
import { RenameModal } from "./RenameModal";
import { FolderPickerModal } from "./FolderPickerModal";
import { InfoModal } from "./InfoModal";
import { ConfirmDeleteFolder } from "./FolderList";
import { PreviewModal, type PreviewFile } from "./PreviewModal";

type Crumb = { id: string; name: string };
type FileHit = PreviewFile & { folderId: string | null; path: Crumb[] };
type FolderHit = { id: string; name: string; parentId: string | null; path: Crumb[] };

function isModified(f: { createdAt: string; updatedAt: string }): boolean {
  return new Date(f.updatedAt).getTime() > new Date(f.createdAt).getTime();
}

// Switch shown in place of the folder view: when a search query OR any filter is
// active we render global (whole-cloud) results, otherwise the normal
// current-folder content.
export function DriveResults({ children }: { children: ReactNode }) {
  const { active } = useFilter();
  return active ? <SearchResults /> : <>{children}</>;
}

function SearchResults() {
  const router = useRouter();
  const f = useFilter();
  const openMenu = useContextMenu();
  const q = f.query.trim();

  const [hits, setHits] = useState<{ files: FileHit[]; folders: FolderHit[] }>({
    files: [],
    folders: [],
  });
  const [loading, setLoading] = useState(false);

  // File modals / preview.
  const [preview, setPreview] = useState<FileHit | null>(null);
  const [editIntent, setEditIntent] = useState(false);
  const [fileRename, setFileRename] = useState<FileHit | null>(null);
  const [fileMove, setFileMove] = useState<FileHit | null>(null);
  const [fileInfo, setFileInfo] = useState<FileHit | null>(null);
  // Folder modals.
  const [folderRename, setFolderRename] = useState<FolderHit | null>(null);
  const [folderMove, setFolderMove] = useState<FolderHit | null>(null);
  const [folderDelete, setFolderDelete] = useState<FolderHit | null>(null);
  const [folderInfo, setFolderInfo] = useState<FolderHit | null>(null);
  const [folderStats, setFolderStats] = useState<{ size: number; count: number } | null>(null);

  // Debounced fetch of the whole-cloud set. Re-runs when the query changes; a
  // query-less fetch (filters only) returns the whole drive for the filters to
  // narrow. setState lives inside the (async) timeout callback, never
  // synchronously in the effect body.
  const active = f.active;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchDriveAction(q);
      if (cancelled) return;
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setHits(res);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, active]);

  // Re-pull results after an action that changed the drive (rename/move/…).
  async function refetch() {
    const res = await searchDriveAction(q);
    if (res && "revoked" in res) {
      window.location.assign("/login");
      return;
    }
    setHits(res);
  }

  function goToFolder(id: string | null) {
    f.setQuery(""); // leave search mode so we land in the folder view
    router.push(id ? `/?folder=${id}` : "/");
  }

  async function download(id: string) {
    const res = await getDownloadUrlAction(id);
    if (typeof res !== "string") {
      window.location.assign("/login");
      return;
    }
    window.location.assign(res);
  }

  async function copy(id: string) {
    await copyFileAction(id);
    refetch();
  }

  async function trash(id: string) {
    const res = await moveFileToTrashAction(id);
    if (res && "revoked" in res) {
      window.location.assign("/login");
      return;
    }
    refetch();
  }

  function openFolderInfo(folder: FolderHit) {
    setFolderInfo(folder);
    setFolderStats(null);
    folderStatsAction(folder.id).then((res) => {
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setFolderStats(res);
    });
  }

  function fileActions(file: FileHit): MenuAction[] {
    return [
      { icon: Download, label: "Descarcă", onSelect: () => download(file.id) },
      ...(isTextEditable(file.name, file.mimeType)
        ? [
            {
              icon: SquarePen,
              label: "Editează",
              onSelect: () => {
                setEditIntent(true);
                setPreview(file);
              },
            },
          ]
        : []),
      { icon: Pencil, label: "Redenumește", onSelect: () => setFileRename(file) },
      { icon: FolderInput, label: "Mută", onSelect: () => setFileMove(file) },
      { icon: Copy, label: "Copiază", onSelect: () => copy(file.id) },
      { icon: Info, label: "Detalii", onSelect: () => setFileInfo(file) },
      { icon: Trash2, label: "Mută în coș", onSelect: () => trash(file.id), danger: true },
    ];
  }

  function folderActions(folder: FolderHit): MenuAction[] {
    return [
      {
        icon: Download,
        label: "Descarcă",
        onSelect: () => window.location.assign(`/api/folder/${folder.id}/download`),
      },
      { icon: Info, label: "Detalii", onSelect: () => openFolderInfo(folder) },
      { icon: Pencil, label: "Redenumește", onSelect: () => setFolderRename(folder) },
      { icon: FolderInput, label: "Mută", onSelect: () => setFolderMove(folder) },
      { icon: Trash2, label: "Șterge", onSelect: () => setFolderDelete(folder), danger: true },
    ];
  }

  // Refine the server hits with the active type/date/size filters, then rank by
  // fuzzy score (the server already substring-matched, so this is order only).
  const files = hits.files
    .filter((h) => fileMatchesFilters(h, f))
    .sort((a, b) => fuzzyScore(q, b.name) - fuzzyScore(q, a.name));
  // Folders carry no type/size/date — hidden once a file-only filter is on.
  const folders = f.fileFiltersActive
    ? []
    : [...hits.folders].sort((a, b) => fuzzyScore(q, b.name) - fuzzyScore(q, a.name));

  const total = files.length + folders.length;

  return (
    <>
      {loading && total === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caut pe tot cloud-ul…
        </div>
      ) : total === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center"
        >
          <Search className="h-7 w-7 text-zinc-600" />
          <p className="mt-3 text-base font-medium text-zinc-300">Niciun rezultat</p>
          <p className="mt-1 text-sm text-zinc-500">
            {q
              ? `Nimic pe tot cloud-ul nu se potrivește cu „${q}”.`
              : "Niciun fișier de pe cloud nu se potrivește cu filtrele."}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-zinc-500">
            {total === 1 ? "1 rezultat" : `${total} rezultate`} pe tot cloud-ul
            {loading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
          </p>

          {folders.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Foldere
              </h2>
              <motion.ul
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >
                {folders.map((folder) => (
                  <motion.li
                    key={folder.id}
                    variants={listItem}
                    onClick={() => goToFolder(folder.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openMenu(folderActions(folder), e.clientX, e.clientY);
                    }}
                    className="group flex cursor-pointer items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
                  >
                    <Folder className="h-5 w-5 shrink-0 text-indigo-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {folder.name}
                      </p>
                      <PathLine path={folder.path} />
                    </div>
                    <ActionMenu actions={folderActions(folder)} label="Opțiuni folder" />
                  </motion.li>
                ))}
              </motion.ul>
            </section>
          )}

          {files.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Fișiere
              </h2>
              <motion.ul
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900"
              >
                {files.map((file) => (
                  <motion.li
                    key={file.id}
                    variants={listItem}
                    onClick={() => setPreview(file)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openMenu(fileActions(file), e.clientX, e.clientY);
                    }}
                    className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-zinc-100">
                        {file.name}
                      </p>
                      <p className="truncate text-sm text-zinc-500">
                        {fileTypeShort(file.name, file.mimeType)} ·{" "}
                        {formatBytes(file.size)} · {formatDateShort(file.createdAt)}
                      </p>
                      <PathLine
                        path={file.path}
                        onNavigate={() => goToFolder(file.folderId)}
                      />
                    </div>
                    <ActionMenu actions={fileActions(file)} label="Opțiuni fișier" />
                  </motion.li>
                ))}
              </motion.ul>
            </section>
          )}
        </div>
      )}

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
            onSaved={() => refetch()}
          />
        )}

        {fileInfo && (
          <InfoModal
            key="file-info"
            title={fileInfo.name}
            onClose={() => setFileInfo(null)}
            rows={[
              { label: "Dimensiune", value: formatBytes(fileInfo.size) },
              { label: "Tip", value: fileTypeLabel(fileInfo.name, fileInfo.mimeType) },
              { label: "Încărcat", value: formatDateTime(fileInfo.createdAt) },
              ...(isModified(fileInfo)
                ? [{ label: "Modificat", value: formatDateTime(fileInfo.updatedAt) }]
                : []),
            ]}
          />
        )}

        {fileRename && (
          <RenameModal
            key="file-rename"
            title="Redenumește fișierul"
            initialName={fileRename.name}
            keepExtension
            onClose={() => setFileRename(null)}
            onRename={async (name) => {
              const res = await renameFileAction(fileRename.id, name);
              if (!res.error) {
                setFileRename(null);
                refetch();
              }
              return res;
            }}
          />
        )}

        {fileMove && (
          <FolderPickerModal
            key="file-move"
            title={`Mută „${fileMove.name}”`}
            onClose={() => setFileMove(null)}
            onPick={async (dest) => {
              const res = await moveFileAction(fileMove.id, dest);
              if (!res.error) {
                setFileMove(null);
                refetch();
              }
              return res;
            }}
          />
        )}

        {folderInfo && (
          <InfoModal
            key="folder-info"
            title={folderInfo.name}
            onClose={() => setFolderInfo(null)}
            rows={[
              { label: "Fișiere", value: folderStats ? String(folderStats.count) : "…" },
              {
                label: "Dimensiune totală",
                value: folderStats ? formatBytes(folderStats.size) : "…",
              },
            ]}
          />
        )}

        {folderRename && (
          <RenameModal
            key="folder-rename"
            title="Redenumește folderul"
            initialName={folderRename.name}
            onClose={() => setFolderRename(null)}
            onRename={async (name) => {
              const res = await renameFolderAction(folderRename.id, name);
              if (!res.error) {
                setFolderRename(null);
                refetch();
              }
              return res;
            }}
          />
        )}

        {folderMove && (
          <FolderPickerModal
            key="folder-move"
            title={`Mută „${folderMove.name}”`}
            excludeSubtreeOf={folderMove.id}
            onClose={() => setFolderMove(null)}
            onPick={async (dest) => {
              const res = await moveFolderAction(folderMove.id, dest);
              if (!res.error) {
                setFolderMove(null);
                refetch();
              }
              return res;
            }}
          />
        )}

        {folderDelete && (
          <ConfirmDeleteFolder
            key="folder-delete"
            name={folderDelete.name}
            onCancel={() => setFolderDelete(null)}
            onConfirm={async () => {
              const res = await deleteFolderAction(folderDelete.id);
              setFolderDelete(null);
              if (res && "revoked" in res) {
                window.location.assign("/login");
                return;
              }
              refetch();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// The location of a hit, root → containing folder. Clickable when onNavigate is
// given (jumps to the folder that holds the item).
function PathLine({
  path,
  onNavigate,
}: {
  path: Crumb[];
  onNavigate?: () => void;
}) {
  const content = (
    <>
      <Home className="h-3 w-3 shrink-0" />
      <span>Acasă</span>
      {path.map((c) => (
        <span key={c.id} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{c.name}</span>
        </span>
      ))}
    </>
  );

  if (!onNavigate) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate();
      }}
      className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-zinc-600 transition hover:text-indigo-400"
    >
      {content}
    </button>
  );
}
