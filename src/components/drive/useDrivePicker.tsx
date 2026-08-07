"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { revalidateDrive } from "@/components/drive/useDriveData";
import { useUploads, type UploadItem } from "./UploadProvider";
import { ensureFolderAction, getUploadTypesAction } from "@/app/drive-actions";
import { fileTypeDenied, type UploadTypesConfig } from "@/lib/upload-types";

export type Entry = { file: File; rel: string };

/* Picking files/folders for upload, extracted from the drive's drop zone so the
   shell's "Nou" menu can start the exact same upload from any page. The hidden
   <input>s are rendered by the caller (see `inputs`), because a picker input has
   to live in the DOM of whichever component owns the button. */
export function useDrivePicker(folderId: string | null) {
  const { enqueue } = useUploads();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // Platform type restrictions for instant picker feedback. Refetched whenever
  // the tab regains focus so a block/unblock made in the dashboard (another tab)
  // applies here without a page refresh. null = unrestricted; the server
  // re-validates on every upload anyway.
  const [types, setTypes] = useState<UploadTypesConfig>(null);
  useEffect(() => {
    const load = () => {
      getUploadTypesAction()
        .then(setTypes)
        .catch(() => {});
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Split picked files into allowed vs denied; toast the denied ones (grouped
  // per reason so 50 blocked .exe files make one toast, not fifty).
  const filterAllowed = useCallback(
    <T extends { file: File }>(items: T[]): T[] => {
      if (types === null) return items;
      const allowed: T[] = [];
      const denied = new Map<string, number>();
      for (const item of items) {
        const reason = fileTypeDenied(item.file.name, types);
        if (reason) denied.set(reason, (denied.get(reason) ?? 0) + 1);
        else allowed.push(item);
      }
      for (const [reason, count] of denied) {
        toast.error(count === 1 ? reason : `${count} fișiere respinse: ${reason}`);
      }
      return allowed;
    },
    [types],
  );

  // Resolve each file's folder (creating the tree as needed) and enqueue.
  const enqueuePaths = useCallback(
    async (allEntries: Entry[]) => {
      // Filter FIRST so folders aren't created for files that get rejected.
      const entries = filterAllowed(allEntries);
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
        if (entries.some((e) => e.rel.includes("/"))) revalidateDrive();
      }
    },
    [enqueue, filterAllowed, folderId],
  );

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const items = filterAllowed(files.map((file) => ({ file, folderId })));
    if (items.length) enqueue(items);
    if (filesRef.current) filesRef.current.value = "";
  }

  function onPickFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    void enqueuePaths(
      files.map((file) => ({ file, rel: file.webkitRelativePath || file.name })),
    );
    if (folderRef.current) folderRef.current.value = "";
  }

  const inputs = (
    <>
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
    </>
  );

  return {
    inputs,
    openFiles: () => filesRef.current?.click(),
    openFolder: () => folderRef.current?.click(),
    enqueuePaths,
  };
}

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

export async function entriesFromDrop(dt: DataTransfer): Promise<Entry[]> {
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
