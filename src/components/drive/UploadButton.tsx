"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUploadAction, confirmUploadAction } from "@/app/drive-actions";

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const contentType = file.type || "application/octet-stream";

      // 1. ask the server for a presigned PUT URL
      const { url, key } = await createUploadAction({
        name: file.name,
        size: file.size,
        contentType,
      });

      // 2. upload bytes straight to R2
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!res.ok) throw new Error("Upload eșuat.");

      // 3. persist metadata
      await confirmUploadAction({ name: file.name, size: file.size, contentType, key });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input ref={inputRef} type="file" hidden onChange={onFile} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Se încarcă…" : "Upload"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
