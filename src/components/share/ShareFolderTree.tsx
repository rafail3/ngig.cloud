"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { File as FileIcon, Folder, FolderOpen, ChevronRight, Eye } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { ShareFolderNode, ShareFileNode } from "@/lib/share";
import { SharePreviewModal, type SharePreviewTarget } from "./SharePreviewModal";

// Browsable, read-only contents of a shared folder: subfolders expand/collapse,
// previewable files open a pop-up. One preview modal is owned at the root.
export function ShareFolderTree({ node }: { node: ShareFolderNode }) {
  const [preview, setPreview] = useState<SharePreviewTarget | null>(null);
  const empty = node.folders.length === 0 && node.files.length === 0;

  return (
    <>
      {empty ? (
        <p className="px-1 py-6 text-center text-sm text-zinc-500">Folder gol.</p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto pr-1">
          <NodeChildren node={node} depth={0} onPreview={setPreview} />
        </div>
      )}
      <SharePreviewModal target={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function NodeChildren({
  node,
  depth,
  onPreview,
}: {
  node: ShareFolderNode;
  depth: number;
  onPreview: (t: SharePreviewTarget) => void;
}) {
  return (
    <ul className="space-y-1">
      {node.folders.map((f) => (
        <FolderRow key={f.id} node={f} depth={depth} onPreview={onPreview} />
      ))}
      {node.files.map((f, i) => (
        <FileRow key={`f${i}`} file={f} depth={depth} onPreview={onPreview} />
      ))}
    </ul>
  );
}

function FolderRow({
  node,
  depth,
  onPreview,
}: {
  node: ShareFolderNode;
  depth: number;
  onPreview: (t: SharePreviewTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = node.folders.length + node.files.length;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        className="flex w-full items-center gap-2 rounded-lg border border-transparent py-2 pr-3 text-left transition-colors hover:border-zinc-800/70 hover:bg-zinc-900/50"
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
              <NodeChildren node={node} depth={depth + 1} onPreview={onPreview} />
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
  file: ShareFileNode;
  depth: number;
  onPreview: (t: SharePreviewTarget) => void;
}) {
  const canPreview = file.previewUrl != null && file.previewKind != null;
  return (
    <li>
      <button
        type="button"
        disabled={!canPreview}
        onClick={() =>
          canPreview &&
          onPreview({ url: file.previewUrl!, kind: file.previewKind!, name: file.name })
        }
        style={{ paddingLeft: `${depth * 16 + 32}px` }}
        className={`flex w-full items-center gap-2 rounded-lg border border-transparent py-2 pr-3 text-left transition-colors ${
          canPreview
            ? "cursor-pointer hover:border-zinc-800/70 hover:bg-zinc-900/50"
            : "cursor-default"
        }`}
      >
        <FileIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{file.name}</span>
        {file.size != null && (
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">
            {formatBytes(file.size)}
          </span>
        )}
        {canPreview && <Eye className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />}
      </button>
    </li>
  );
}
