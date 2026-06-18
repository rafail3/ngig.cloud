"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Upload, FolderUp, FolderPlus, UploadCloud } from "lucide-react";
import { useUploads, type UploadItem } from "./UploadProvider";
import { ensureFolderAction, createFolderAction } from "@/app/drive-actions";
import { ModalShell } from "./anim";

type Entry = { file: File; rel: string };

// Recursively collect files (with relative paths) from a dropped entry.
async function walk(
  entry: FileSystemEntry,
  prefix: string,
  out: Entry[],
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((res, rej) => fileEntry.file(res, rej));
    out.push({ file, rel: prefix + entry.name });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((res, rej) =>
        reader.readEntries(res, rej),
      );
      for (const e of batch) await walk(e, prefix + entry.name + "/", out);
    } while (batch.length > 0);
  }
}

async function entriesFromDrop(dt: DataTransfer): Promise<Entry[]> {
  const out: Entry[] = [];
  const roots = Array.from(dt.items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));
  if (roots.length > 0) {
    for (const e of roots) await walk(e, "", out);
  } else {
    for (const f of Array.from(dt.files)) out.push({ file: f, rel: f.name });
  }
  return out;
}

export function UploadArea({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const { enqueue } = useUploads();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);

  // Resolve each file's folder (creating the tree as needed) and enqueue.
  async function enqueuePaths(entries: Entry[]) {
    const cache = new Map<string, string | null>();
    cache.set("", folderId);
    const items: UploadItem[] = [];

    for (const { file, rel } of entries) {
      const parts = rel.split("/").filter(Boolean);
      const dirs = parts.slice(0, -1);
      const dirPath = dirs.join("/");

      let target = cache.get(dirPath);
      if (target === undefined) {
        let parent = folderId;
        let acc = "";
        for (const seg of dirs) {
          acc = acc ? `${acc}/${seg}` : seg;
          let fid = cache.get(acc);
          if (fid === undefined) {
            const res = await ensureFolderAction(seg, parent);
            if ("revoked" in res) {
              window.location.assign("/login");
              return;
            }
            fid = res.id;
            cache.set(acc, fid);
          }
          parent = fid;
        }
        target = parent;
        cache.set(dirPath, target);
      }
      items.push({ file, folderId: target });
    }

    if (items.length) {
      enqueue(items);
      // Folders may have been created — refresh so they show up.
      if (entries.some((e) => e.rel.includes("/"))) router.refresh();
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) enqueue(files.map((file) => ({ file, folderId })));
    if (filesRef.current) filesRef.current.value = "";
  }

  function onPickFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    void enqueuePaths(
      files.map((file) => ({ file, rel: file.webkitRelativePath || file.name })),
    );
    if (folderRef.current) folderRef.current.value = "";
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const entries = await entriesFromDrop(e.dataTransfer);
    if (entries.length) void enqueuePaths(entries);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={filesRef} type="file" multiple hidden onChange={onPickFiles} />
        {/* webkitdirectory makes the picker select a whole folder */}
        <input
          ref={folderRef}
          type="file"
          hidden
          onChange={onPickFolder}
          // @ts-expect-error non-standard but widely supported folder-picker attrs
          webkitdirectory=""
          directory=""
        />
        <button
          type="button"
          onClick={() => filesRef.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400"
        >
          <Upload className="h-4 w-4" /> Fișiere
        </button>
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          <FolderUp className="h-4 w-4" /> Folder
        </button>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          <FolderPlus className="h-4 w-4" /> Folder nou
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-6 py-7 text-center transition-colors ${
          dragOver
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-zinc-800 bg-zinc-900/30"
        }`}
      >
        <UploadCloud
          className={`h-6 w-6 ${dragOver ? "text-indigo-400" : "text-zinc-500"}`}
        />
        <p className="text-sm text-zinc-400">
          Trage fișiere sau foldere aici
        </p>
      </div>

      <AnimatePresence>
        {creating && (
          <CreateFolderModal
            key="create"
            parentId={folderId}
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateFolderModal({
  parentId,
  onClose,
  onCreated,
}: {
  parentId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createFolderAction(name, parentId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onCreated();
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="text-base font-semibold text-zinc-100">Folder nou</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume folder"
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
            {busy ? "Se creează…" : "Creează"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
