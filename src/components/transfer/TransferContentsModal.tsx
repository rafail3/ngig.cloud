"use client";

import { useEffect, useState } from "react";
import { File as FileIcon, Folder, FolderOpen, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatBytes } from "@/lib/format";
import { ModalShell } from "@/components/drive/anim";
import { SharePreviewModal, type SharePreviewTarget } from "@/components/share/SharePreviewModal";
import { getTransferContentsAction } from "@/app/(app)/transfers/actions";
import type { TransferContents, TransferFolderNode, TransferFileNode } from "@/lib/transfer";

// Preview-only look inside a still-pending transfer — same browsable-tree
// pattern as the public share page (ShareFolderTree), but reads through the
// server-side sender/recipient guard in getTransferContents instead of a
// share token, and never exposes a download URL: items only actually land in
// the recipient's drive via Accept.
export function TransferContentsModal({
  transferId,
  title,
  onClose,
}: {
  transferId: string;
  title: string;
  onClose: () => void;
}) {
  const [contents, setContents] = useState<TransferContents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SharePreviewTarget | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await getTransferContentsAction(transferId);
      if (!active) return;
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setContents(res);
    })();
    return () => {
      active = false;
    };
  }, [transferId]);

  const empty = contents && contents.folders.length === 0 && contents.files.length === 0;

  return (
    <ModalShell
      onClose={onClose}
      className="max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-all text-base font-semibold text-zinc-100">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="shrink-0 rounded p-1 text-zinc-400 transition hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <p className="px-1 py-6 text-center text-sm text-red-400">{error}</p>
      ) : !contents ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      ) : empty ? (
        <p className="px-1 py-6 text-center text-sm text-zinc-500">Niciun element disponibil.</p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto pr-1">
          <ul className="space-y-1">
            {contents.folders.map((f) => (
              <FolderRow key={f.id} node={f} depth={0} onPreview={setPreview} />
            ))}
            {contents.files.map((f, i) => (
              <FileRow key={`f${i}`} file={f} depth={0} onPreview={setPreview} />
            ))}
          </ul>
        </div>
      )}

      <SharePreviewModal target={preview} onClose={() => setPreview(null)} lockScroll={false} />
    </ModalShell>
  );
}

const rowClass =
  "flex items-center gap-1.5 rounded-lg border border-transparent pr-1.5 transition-colors hover:border-zinc-800/70 hover:bg-zinc-900/50";

function FolderRow({
  node,
  depth,
  onPreview,
}: {
  node: TransferFolderNode;
  depth: number;
  onPreview: (t: SharePreviewTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = node.folders.length + node.files.length;

  return (
    <li>
      <div className={rowClass}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          />
          <span className="text-indigo-400" aria-hidden>
            {open ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">
            {node.name}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">{count}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && count > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <ul className="space-y-1">
                {node.folders.map((f) => (
                  <FolderRow key={f.id} node={f} depth={depth + 1} onPreview={onPreview} />
                ))}
                {node.files.map((f, i) => (
                  <FileRow key={`f${i}`} file={f} depth={depth + 1} onPreview={onPreview} />
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function FileRow({
  file,
  depth,
  onPreview,
}: {
  file: TransferFileNode;
  depth: number;
  onPreview: (t: SharePreviewTarget) => void;
}) {
  const canPreview = file.previewUrl != null && file.previewKind != null;
  const pad = { paddingLeft: `${depth * 16 + 30}px` };

  const inner = (
    <>
      <FileIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{file.name}</span>
      <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatBytes(file.size)}</span>
      {canPreview && <Eye className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />}
    </>
  );

  return (
    <li>
      <div className={rowClass}>
        {canPreview ? (
          <button
            type="button"
            onClick={() =>
              onPreview({ url: file.previewUrl!, kind: file.previewKind!, name: file.name })
            }
            style={pad}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
          >
            {inner}
          </button>
        ) : (
          <div style={pad} className="flex min-w-0 flex-1 items-center gap-2 py-2">
            {inner}
          </div>
        )}
      </div>
    </li>
  );
}
