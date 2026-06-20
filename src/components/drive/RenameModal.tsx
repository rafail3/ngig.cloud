"use client";

import { useState } from "react";
import { ModalShell } from "./anim";

/* Rename dialog shared by files and folders (and the selection bar). `onRename`
   performs the rename and returns `{ error? }`; on success it should close. */
export function RenameModal({
  title,
  initialName,
  onClose,
  onRename,
}: {
  title: string;
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<{ error?: string }>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await onRename(name);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
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
            {busy ? "Se salvează…" : "Salvează"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
