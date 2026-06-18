"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Home, Folder, X } from "lucide-react";
import { listAllFoldersAction, moveFolderAction } from "@/app/drive-actions";
import { ModalShell } from "./anim";

type F = { id: string; name: string; parent_id: string | null };

export function MoveFolderModal({
  folder,
  onClose,
  onMoved,
}: {
  folder: { id: string; name: string };
  onClose: () => void;
  onMoved: () => void;
}) {
  const [folders, setFolders] = useState<F[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAllFoldersAction().then((res) => {
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setFolders(res);
    });
  }, []);

  async function move(dest: string | null) {
    setBusy(true);
    setError(null);
    const res = await moveFolderAction(folder.id, dest);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onMoved();
  }

  // Exclude the folder itself and its descendants as destinations.
  const excluded = new Set<string>([folder.id]);
  if (folders) {
    const childrenOf = new Map<string, string[]>();
    for (const f of folders) {
      if (!f.parent_id) continue;
      const a = childrenOf.get(f.parent_id) ?? [];
      a.push(f.id);
      childrenOf.set(f.parent_id, a);
    }
    const stack = [folder.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childrenOf.get(cur) ?? []) {
        if (!excluded.has(c)) {
          excluded.add(c);
          stack.push(c);
        }
      }
    }
  }

  function renderLevel(parent: string | null, depth: number): ReactNode[] {
    if (!folders) return [];
    return folders
      .filter((f) => f.parent_id === parent && !excluded.has(f.id))
      .flatMap((f) => [
        <button
          key={f.id}
          type="button"
          onClick={() => move(f.id)}
          disabled={busy}
          style={{ paddingLeft: depth * 18 + 12 }}
          className="flex w-full items-center gap-2 py-2 pr-3 text-left text-sm text-zinc-200 transition hover:bg-zinc-800/70 disabled:opacity-50"
        >
          <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
          <span className="truncate">{f.name}</span>
        </button>,
        ...renderLevel(f.id, depth + 1),
      ]);
  }

  return (
    <ModalShell
      onClose={onClose}
      className="flex max-h-[80vh] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <h3 className="min-w-0 truncate text-base font-semibold text-zinc-100">
          Mută „{folder.name}”
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="rounded p-1 text-zinc-400 transition hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="px-4 pt-3 text-xs text-zinc-500">Alege destinația:</p>
      <div className="mt-1 flex-1 overflow-auto py-1">
        <button
          type="button"
          onClick={() => move(null)}
          disabled={busy}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-800/70 disabled:opacity-50"
        >
          <Home className="h-4 w-4 shrink-0 text-indigo-400" />
          Acasă (rădăcină)
        </button>
        {folders === null ? (
          <p className="px-4 py-3 text-sm text-zinc-500">Se încarcă…</p>
        ) : (
          renderLevel(null, 0)
        )}
      </div>

      {error && <p className="border-t border-zinc-800 px-4 py-2 text-sm text-red-400">{error}</p>}
    </ModalShell>
  );
}
