"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Search, Loader2, Folder, File as FileIcon, Check, X } from "lucide-react";
import { ModalShell } from "@/components/drive/anim";
import { searchDriveAction, listAllFoldersAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import type { ShareTargetType } from "@/lib/share";

export type PickedTarget = { type: ShareTargetType; id: string; name: string };

type Crumb = { id: string; name: string };
type FolderRow = { id: string; name: string; parent_id: string | null };
type Row = {
  type: ShareTargetType;
  id: string;
  name: string;
  size: number | null;
  path: Crumb[];
};

// Pick files/folders to send, from anywhere in your drive.
//
// Deliberately a searchable FLAT list rather than an expandable tree: you
// almost always know the name of what you want to send, and `searchDriveAction`
// already returns whole-drive hits with their ancestor path — so typing beats
// clicking down a hierarchy, and the path line keeps two same-named files
// distinguishable. An empty query lists the whole drive.
export function FilePickerModal({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: PickedTarget[];
  onCancel: () => void;
  onConfirm: (targets: PickedTarget[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Row[] | null>(null);
  const [allFolders, setAllFolders] = useState<FolderRow[] | null>(null);
  const [picked, setPicked] = useState<PickedTarget[]>(initial);

  // Folders come from the full folder list, NOT from searchDrive: with an empty
  // query searchDrive deliberately returns no folders (in the drive's own
  // search the file filters drive that view, so unmatched folders are noise).
  // Here an empty query means "show me everything to pick from", so we hold the
  // whole folder tree and match it client-side. It is the same list the drive's
  // move-destination picker loads, so it is a known-cheap read.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listAllFoldersAction();
      if (cancelled) return;
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setAllFolders(res);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Files still come from the server search (it handles tokenizing, escaping
  // and the result caps; an empty query returns the whole drive).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchDriveAction(query.trim());
      if (cancelled) return;
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setFiles(
        res.files.map((f) => ({
          type: "file" as const,
          id: f.id,
          name: f.name,
          size: f.size,
          path: f.path,
        })),
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Ancestor crumbs for a folder, walked from the flat parent_id list. The 64
  // cap mirrors the server's own guard against a cycle in malformed data.
  function pathOf(folderId: string | null, byId: Map<string, FolderRow>): Crumb[] {
    const crumbs: Crumb[] = [];
    let id = folderId;
    for (let i = 0; id && i < 64; i++) {
      const f = byId.get(id);
      if (!f) break;
      crumbs.unshift({ id: f.id, name: f.name });
      id = f.parent_id;
    }
    return crumbs;
  }

  // Every whitespace-separated token must appear in the name — same AND rule
  // the server applies to file names, so folders and files rank alike.
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const byId = new Map((allFolders ?? []).map((f) => [f.id, f]));
  const folderRows: Row[] = (allFolders ?? [])
    .filter((f) => {
      const name = f.name.toLowerCase();
      return tokens.every((t) => name.includes(t));
    })
    .map((f) => ({
      type: "folder" as const,
      id: f.id,
      name: f.name,
      size: null,
      path: pathOf(f.parent_id, byId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));

  // Folders first: sending a whole folder is the coarser, more common intent.
  const rows: Row[] | null =
    files === null || allFolders === null ? null : [...folderRows, ...files];

  const pickedIds = new Set(picked.map((p) => `${p.type}:${p.id}`));

  function toggle(row: Row) {
    const key = `${row.type}:${row.id}`;
    setPicked((prev) =>
      pickedIds.has(key)
        ? prev.filter((p) => `${p.type}:${p.id}` !== key)
        : [...prev, { type: row.type, id: row.id, name: row.name }],
    );
  }

  return (
    <ModalShell
      onClose={onCancel}
      className="flex max-h-[85dvh] max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <h3 className="min-w-0 truncate text-base font-semibold text-zinc-100">
          Alege ce trimiți
        </h3>
        <Button variant="unstyled"
          type="button"
          onClick={onCancel}
          aria-label="Închide"
          className="rounded p-1 text-zinc-400 transition hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-zinc-800 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută în drive-ul tău…"
            aria-label="Caută fișiere și foldere"
            autoFocus
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {rows === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-zinc-500">
            {query.trim()
              ? `Nimic pentru „${query.trim()}”.`
              : "Drive-ul tău este gol."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((row) => {
              const on = pickedIds.has(`${row.type}:${row.id}`);
              return (
                <li key={`${row.type}:${row.id}`}>
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => toggle(row)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      on
                        ? "border-indigo-400/50 bg-indigo-500/10"
                        : "border-transparent hover:bg-zinc-800/60"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        on
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-zinc-700"
                      }`}
                      aria-hidden
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    {row.type === "folder" ? (
                      <Folder className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                    ) : (
                      <FileIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-100">
                        {row.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {row.path.length > 0
                          ? row.path.map((c) => c.name).join(" / ")
                          : "Acasă"}
                        {row.size != null && ` · ${formatBytes(row.size)}`}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-3">
        <span className="text-xs text-zinc-500">
          {picked.length === 0
            ? "Niciun element ales"
            : `${picked.length} ${picked.length === 1 ? "element ales" : "elemente alese"}`}
        </span>
        <div className="flex gap-2">
          <Button variant="unstyled"
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Anulează
          </Button>
          <Button variant="unstyled"
            type="button"
            onClick={() => onConfirm(picked)}
            disabled={picked.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            <FileIcon className="h-4 w-4" />
            Confirmă
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
