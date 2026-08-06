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
  CheckCircle2,
  Share2,
  Play,
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
import {
  fileTypeShort,
  fileTypeLabel,
  isTextEditable,
  textBadge,
} from "@/lib/file-type";
import { isOfficeEditable, officeCanEdit, officeEditUnavailable } from "@/lib/office";
import { useUploads, type UploadJob } from "./UploadProvider";
import { useOfficeStatus } from "./OfficeStatusProvider";
import { FileTypeIcon } from "./FileTypeIcon";
import { OfficeEditor } from "./OfficeEditor";
import { PreviewModal } from "./PreviewModal";
import { InfoModal } from "./InfoModal";
import { FolderPickerModal } from "./FolderPickerModal";
import { ActionMenu, type MenuAction } from "./ActionMenu";
import { useContextMenu } from "./ContextMenu";
import { useSelection, selKey, type SelItem } from "./SelectionProvider";
import { useLongPress } from "./useLongPress";
import { useThumbBackfill } from "./useThumbBackfill";
import { RenameModal } from "./RenameModal";
import { ShareModal } from "./ShareModal";
import { useMounted, useIsTouch, useRowClick } from "./anim";
import { useDragActive, usePendingMove, type DragData } from "./DriveDndProvider";
import { useFilter } from "./FilterProvider";
import { useViewMode, type ViewMode } from "./useViewMode";

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
function UploadingRow({ job, variant }: { job: UploadJob; variant: ViewMode }) {
  const pct = job.size > 0 ? Math.min(100, Math.round((job.sent / job.size) * 100)) : 0;
  return (
    <motion.li
      // In grid mode an in-flight upload spans the whole row rather than
      // pretending to be a card: it has no preview to show yet, and a
      // half-height cell among real cards reads as a broken tile.
      className={
        variant === "grid"
          ? "col-span-full rounded-xl border border-zinc-800/70 bg-zinc-900/30 px-3.5 py-3 opacity-70"
          : "px-3.5 py-3 opacity-55"
      }
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />
          <p className="truncate text-sm font-medium text-zinc-200">{job.name}</p>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">
          {job.status === "queued"
            ? "În așteptare"
            : job.status === "done"
              ? "Finalizare…"
              : `${speedLabel(job.speed)} · ${etaLabel(job.etaSec)}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs tabular-nums text-zinc-500">
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
  // Present only for images/videos uploaded after thumbnails shipped.
  thumbKey?: string | null;
  // Set when a backfill attempt already failed for this file (see
  // useThumbBackfill) — it is then never retried.
  thumbFailedAt?: string | null;
};

// Older rows can carry application/octet-stream, so the name is the fallback.
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv|avi)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac|opus|wma)$/i;

/* Audio has no frame to show, so the tile is made rather than captured: a
   gradient with a play badge, the language every music surface uses.

   Five of them, picked by the file's id, so a folder of tracks doesn't read as
   one repeated block — and so a given file always looks the same, which is what
   makes a cover useful for finding it again.

   Two stops, not three, and deliberately NOT the indigo→violet→fuchsia sweep:
   that particular three-stop purple is the single most recognisable mark of a
   machine-made interface. A duotone with real distance between its ends reads
   like a record sleeve instead. The first pair stays on the app's own indigo so
   the set is anchored to the brand; the rest carry the variety. */
const AUDIO_GRADIENTS = [
  "from-indigo-700 to-sky-400",
  "from-rose-600 to-amber-400",
  "from-emerald-700 to-lime-400",
  "from-cyan-700 to-indigo-400",
  "from-orange-600 to-rose-500",
];

function gradientFor(id: string): string {
  // Any stable spread will do; this is the cheapest one that doesn't clump on
  // the sequential characters a uuid is full of.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AUDIO_GRADIENTS[h % AUDIO_GRADIENTS.length];
}

function AudioTile({ id, variant }: { id: string; variant: ViewMode }) {
  return (
    <div
      aria-hidden
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(id)}`}
    >
      <PlayBadge variant={variant} />
    </div>
  );
}

/* The same badge a video thumbnail carries. Shared on purpose: "this plays" is
   one idea, and it should not look like two. */
function PlayBadge({ variant }: { variant: ViewMode }) {
  return (
    <span
      className={
        variant === "grid"
          ? "flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/55 text-white ring-1 ring-white/25 backdrop-blur-[2px] transition-transform duration-150 group-hover:scale-110"
          : "flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950/60 text-white ring-1 ring-white/25"
      }
    >
      {/* Nudged right by a pixel: a triangle centred by its bounding box reads
          as sitting slightly left of centre. */}
      <Play
        className={`translate-x-px fill-current ${
          variant === "grid" ? "h-4 w-4" : "h-2.5 w-2.5"
        }`}
      />
    </span>
  );
}

/* What a text or code file shows instead of a preview: the format, spelled out
   on a plain grey field. There is nothing to fetch and nothing to store — the
   badge comes from the filename, so it is right the moment the row appears, for
   every file that ever existed.

   The label carries the recognition, so it gets the size; longer names step down
   rather than wrap, because a wrapped "JAVASCRIPT" reads as two words. */
function TypeBadge({ label }: { label: string }) {
  // Sized against the narrowest card the grid produces (two columns on a small
  // phone), so the longest labels still fit on one line there. Letter-spacing
  // eases off as the text grows: what opens up a small word crowds a big one.
  const size =
    label.length <= 4
      ? "text-4xl tracking-[0.08em]"
      : label.length <= 6
        ? "text-2xl tracking-[0.1em]"
        : label.length <= 8
          ? "text-lg tracking-[0.12em]"
          : "text-sm tracking-[0.14em]";

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-800 px-2">
      <span className={`${size} truncate font-bold text-zinc-200`}>{label}</span>
    </div>
  );
}

/* The real image in place of the type icon, in the exact same 36px box so a
   folder of mixed files doesn't get a ragged left edge.

   Falls back to the type icon if the thumbnail 404s — the row must never show a
   broken image, and a thumbnail can legitimately go missing (B2 object pruned,
   an old row pointing at a deleted key). Plain <img>, not next/image: these are
   already sized and cached by the route, so the optimizer would add a hop for
   nothing. */
function Thumb({
  id,
  name,
  mime,
  variant = "list",
}: {
  id: string;
  name: string;
  mime: string | null;
  variant?: ViewMode;
}) {
  // A page is portrait and the grid's box is landscape, so a centred crop would
  // cut the head off a document — which is the part that identifies it. Photos
  // keep the centre crop, where the subject usually is.
  const docLike = mime === "application/pdf" || /\.pdf$/i.test(name);
  const [failed, setFailed] = useState(false);
  // Backfilled thumbnails land while the row is already on screen; fading them
  // in keeps that from reading as a glitch. Cached ones fade too, over ~1 frame.
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    // Never a broken-image box: fall back to exactly what a file without a
    // thumbnail shows, centred in the grid's preview area.
    return variant === "grid" ? (
      <div className="flex h-full w-full items-center justify-center">
        <FileTypeIcon name={name} mime={mime} />
      </div>
    ) : (
      <FileTypeIcon name={name} mime={mime} />
    );
  }

  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/api/thumb/${id}`}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover transition-opacity duration-300 ${
        docLike ? "object-top" : ""
      } ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );

  // A poster frame is indistinguishable from a photo, so a video says so with a
  // play badge — the same convention every video surface uses. Only once the
  // frame is actually there: a badge floating over an empty box promises a
  // preview that hasn't arrived.
  const isVideo = (mime ?? "").startsWith("video/") || VIDEO_EXT.test(name);
  const badge = isVideo && loaded && (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <PlayBadge variant={variant} />
    </span>
  );

  return variant === "grid" ? (
    <>
      {img}
      {badge}
    </>
  ) : (
    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
      {img}
      {badge}
    </span>
  );
}

// A file counts as "modified" only once its content has actually changed
// (in-app editing) — updated_at moves past created_at. Rename/move don't.
function isModified(f: { createdAt: string; updatedAt: string }): boolean {
  return new Date(f.updatedAt).getTime() > new Date(f.createdAt).getTime();
}

export function FileList({ folderId }: { folderId: string | null }) {
  const { jobs } = useUploads();
  const officeStatus = useOfficeStatus();
  // `files` is filtered for display; `rawFiles` is the full set, used only to
  // tell when an upload's real row has arrived (so its ghost can disappear).
  const { files, rawFiles } = useFilter();
  const view = useViewMode();
  // Files uploaded before thumbnails shipped get theirs generated in the
  // background, as they are rendered. Returns the ids done in this session.
  const backfilled = useThumbBackfill(files);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileItem | null>(null);
  // True when the preview was opened straight into edit mode (Editează action).
  const [editIntent, setEditIntent] = useState(false);
  const [info, setInfo] = useState<FileItem | null>(null);
  const [toRename, setToRename] = useState<FileItem | null>(null);
  const [toMove, setToMove] = useState<FileItem | null>(null);
  const [toShare, setToShare] = useState<FileItem | null>(null);
  // Office documents open in the OnlyOffice editor instead of the text one.
  const [officeFile, setOfficeFile] = useState<FileItem | null>(null);

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
      <ul
        className={
          view === "grid"
            ? "drive-list grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : "drive-list divide-y divide-zinc-800/40 overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-900/20"
        }
      >
          {uploading.map((job) => (
            <UploadingRow key={job.id} job={job} variant={view} />
          ))}
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              folderId={folderId}
              variant={view}
              // A thumbnail generated moments ago in this tab: the row must show
              // it now, not after the next refetch.
              hasThumb={Boolean(f.thumbKey) || backfilled.has(f.id)}
              pending={pendingId === f.id}
              onPreview={() => setPreview(f)}
              onEdit={() => {
                if (isOfficeEditable(f.name)) {
                  // Offered but the server is down (onlyoffice-only mode): say so
                  // instead of opening an editor that can't load.
                  if (officeEditUnavailable(officeStatus, f.name)) {
                    toast.error(
                      "Serviciul de editare e temporar indisponibil. Revine în scurt timp.",
                    );
                    return;
                  }
                  setOfficeFile(f);
                  return;
                }
                setEditIntent(true);
                setPreview(f);
              }}
              onInfo={() => setInfo(f)}
              onRename={() => setToRename(f)}
              onMove={() => setToMove(f)}
              onShare={() => setToShare(f)}
              onCopy={() => copy(f)}
              onArchive={() => archive(f)}
              onDownload={() => download(f.id)}
              onTrash={() => trash(f)}
            />
          ))}
      </ul>

      {officeFile && (
        <OfficeEditor
          fileId={officeFile.id}
          name={officeFile.name}
          onClose={() => setOfficeFile(null)}
        />
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

        {toShare && (
          <ShareModal
            key="share"
            targets={[{ type: "file", id: toShare.id, name: toShare.name }]}
            onClose={() => setToShare(null)}
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
  variant,
  hasThumb,
  onPreview,
  onEdit,
  onInfo,
  onRename,
  onMove,
  onShare,
  onCopy,
  onArchive,
  onDownload,
  onTrash,
}: {
  file: FileItem;
  folderId: string | null;
  pending: boolean;
  variant: ViewMode;
  hasThumb: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onInfo: () => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onCopy: () => void;
  onArchive: () => void;
  onDownload: () => void;
  onTrash: () => void;
}) {
  const openMenu = useContextMenu();
  const selection = useSelection();
  const officeStatus = useOfficeStatus();
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
  // Non-null for text and code files, which show their format instead of a
  // preview (there is nothing in a wall of text to recognise at this size).
  const badge = textBadge(file.name, file.mimeType);
  // Audio has no frame to capture, so the grid shows a made cover instead of a
  // music-note icon on an empty field.
  const isAudio =
    (file.mimeType ?? "").startsWith("audio/") || AUDIO_EXT.test(file.name);
  const longPress = useLongPress(() => selection.toggle(item));
  const handleRowClick = useRowClick({
    isTouch,
    onSelect: (mods) => selection.handleClick(item, mods),
    onOpen: onPreview,
  });

  const actions: MenuAction[] = [
    { icon: Download, label: "Descarcă", onSelect: onDownload },
    { icon: Share2, label: "Partajează", onSelect: onShare },
    ...(isTextEditable(file.name, file.mimeType) ||
    officeCanEdit(officeStatus, file.name)
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
        // Touch + active selection: a tap toggles this item — never opens the
        // preview. Long-press is only needed for the FIRST item.
        if (isTouch && selection.count > 0) {
          selection.toggle(item);
          return;
        }
        handleRowClick(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // Mobile browsers synthesize a contextmenu on long-press, which used
        // to pop the menu on every press. On touch, long-press is
        // selection-only — the bottom bar (and the kebab) carry the actions.
        if (isTouch) return;
        openMenu(actions, e.clientX, e.clientY);
      }}
      // Use 1 (not undefined) for the normal state: framer-motion doesn't reset
      // opacity when the style prop becomes undefined, which left a stuck ghost.
      style={{ opacity: dimmed ? 0.4 : busy ? 0.5 : 1 }}
      // `longPress.pressing` gives the finger something to see during the hold
      // — without it the row is inert for the full delay and the press reads as
      // ignored. transform-only, so it can't reflow the list mid-scroll.
      className={
        variant === "grid"
          ? `group flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-[background-color,border-color,transform] duration-150 ${
              longPress.pressing ? "scale-[0.97]" : ""
            } ${
              selected
                ? "border-indigo-400/70 bg-indigo-500/10"
                : "border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
            }`
          : `group flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-[background-color,transform] duration-150 ${
              longPress.pressing ? "scale-[0.985] bg-zinc-800/60" : ""
            } ${selected ? "bg-indigo-500/10" : "hover:bg-zinc-900/50"}`
      }
    >
      {variant === "grid" ? (
        <>
          {/* The preview does the recognising, so it gets the space. 4:3 rather
              than square: most documents and photos are landscape-ish, and a
              square box would letterbox nearly everything. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950/60">
            {/* The badge wins over a thumbnail: rows written before text files
                stopped generating one would otherwise still show it. */}
            {badge ? (
              <TypeBadge label={badge} />
            ) : isAudio ? (
              <AudioTile id={file.id} variant="grid" />
            ) : hasThumb ? (
              <Thumb id={file.id} name={file.name} mime={file.mimeType} variant="grid" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FileTypeIcon name={file.name} mime={file.mimeType} />
              </div>
            )}
            {selected && (
              <span
                aria-hidden
                className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white shadow"
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
            )}
            {busy && (
              <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 px-2.5 py-2">
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium leading-6 text-zinc-100">
                {file.name}
              </p>
              <p className="truncate text-xs leading-5 text-zinc-400">
                {fileTypeShort(file.name, file.mimeType)} · {formatBytes(file.size)}
              </p>
            </div>
            <ActionMenu actions={actions} label="Opțiuni fișier" />
          </div>
        </>
      ) : (
        <>
      {selected ? (
        // Selected rows swap the type icon for a check — the selection reads
        // instantly, Google-Drive style, especially on mobile.
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15"
        >
          <CheckCircle2 className="h-[18px] w-[18px] text-indigo-400" />
        </span>
      ) : hasThumb && !badge ? (
        // In the list the icon already reads at 36px, and the subtitle spells
        // the type out — the badge is a grid affordance only.
        <Thumb id={file.id} name={file.name} mime={file.mimeType} />
      ) : (
        <FileTypeIcon name={file.name} mime={file.mimeType} />
      )}
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-zinc-100">{file.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
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
        </>
      )}
    </motion.li>
  );
}
