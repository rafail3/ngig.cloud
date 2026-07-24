"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  File as FileIcon,
  Folder,
  FolderOpen,
  ChevronRight,
  Eye,
  Download,
} from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { ShareFolderNode, ShareFileNode } from "@/lib/share";
import { SharePreviewModal, type SharePreviewTarget } from "./SharePreviewModal";

// Browsable, read-only contents of a shared folder/bundle: subfolders
// expand/collapse, previewable files open a pop-up, and every file/folder has
// its own download button. One preview modal is owned at the root.
export function ShareFolderTree({
  node,
  token,
}: {
  node: ShareFolderNode;
  token: string;
}) {
  const [preview, setPreview] = useState<SharePreviewTarget | null>(null);
  const empty = node.folders.length === 0 && node.files.length === 0;

  return (
    <>
      {empty ? (
        <p className="px-1 py-6 text-center text-sm text-zinc-500">Folder gol.</p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto pr-1">
          <NodeChildren node={node} depth={0} token={token} onPreview={setPreview} />
        </div>
      )}
      <SharePreviewModal target={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function NodeChildren({
  node,
  depth,
  token,
  onPreview,
}: {
  node: ShareFolderNode;
  depth: number;
  token: string;
  onPreview: (t: SharePreviewTarget) => void;
}) {
  return (
    <ul className="space-y-1">
      {node.folders.map((f) => (
        <FolderRow key={f.id} node={f} depth={depth} token={token} onPreview={onPreview} />
      ))}
      {node.files.map((f, i) => (
        <FileRow key={`f${i}`} file={f} depth={depth} onPreview={onPreview} />
      ))}
    </ul>
  );
}

const rowClass =
  "flex items-center gap-1.5 rounded-lg border border-transparent pr-1.5 transition-colors hover:border-zinc-800/70 hover:bg-zinc-900/50";
const dlBtnClass =
  "shrink-0 rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100";

function FolderRow({
  node,
  depth,
  token,
  onPreview,
}: {
  node: ShareFolderNode;
  depth: number;
  token: string;
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
        <a
          href={`/s/${token}/download?folder=${node.id}`}
          aria-label={`Descarcă ${node.name} (.zip)`}
          title="Descarcă (.zip)"
          className={dlBtnClass}
        >
          <Download className="h-4 w-4" />
        </a>
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
              <NodeChildren
                node={node}
                depth={depth + 1}
                token={token}
                onPreview={onPreview}
              />
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
  const pad = { paddingLeft: `${depth * 16 + 30}px` };

  const inner = (
    <>
      <FileIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{file.name}</span>
      {file.size != null && (
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
          {formatBytes(file.size)}
        </span>
      )}
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
        <a
          href={file.downloadUrl}
          aria-label={`Descarcă ${file.name}`}
          title="Descarcă"
          className={dlBtnClass}
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </li>
  );
}
