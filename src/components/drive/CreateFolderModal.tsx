"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createFolderAction } from "@/app/drive-actions";
import { ModalShell } from "./anim";

// Shared by the drive's own toolbar and the shell's "Nou" menu, so creating a
// folder looks and behaves the same wherever it starts.
export function CreateFolderModal({
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
        <Input variant="unstyled"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume folder"
          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="unstyled"
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Anulează
          </Button>
          <Button variant="unstyled"
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {busy ? "Se creează…" : "Creează"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
