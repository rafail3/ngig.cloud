"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUploadAction,
  confirmUploadAction,
  completeUploadAction,
  abortUploadAction,
} from "@/app/drive-actions";

// How many parts upload at once. 4 saturates most links without flooding the
// browser's connection pool.
const PART_CONCURRENCY = 4;

// PUT a multipart upload's parts to B2 in parallel, capped at PART_CONCURRENCY.
async function uploadParts(
  file: File,
  partUrls: string[],
  partSize: number,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= partUrls.length) return;
      const start = i * partSize;
      const blob = file.slice(start, Math.min(start + partSize, file.size));
      const res = await fetch(partUrls[i], { method: "PUT", body: blob });
      if (!res.ok) throw new Error("Upload eșuat.");
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, partUrls.length) }, worker),
  );
}

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

      // 1. ask the server for an upload plan (single PUT or multipart).
      const plan = await createUploadAction({
        name: file.name,
        size: file.size,
        contentType,
      });
      if ("revoked" in plan) {
        window.location.assign("/login");
        return;
      }

      // 2. upload the bytes straight to B2.
      if (plan.mode === "single") {
        const res = await fetch(plan.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (!res.ok) throw new Error("Upload eșuat.");
      } else {
        try {
          await uploadParts(file, plan.partUrls, plan.partSize);
          const done = await completeUploadAction({
            key: plan.key,
            uploadId: plan.uploadId,
          });
          if (done && "revoked" in done) {
            window.location.assign("/login");
            return;
          }
        } catch (err) {
          // Clean up the half-finished multipart upload, then surface the error.
          await abortUploadAction({ key: plan.key, uploadId: plan.uploadId });
          throw err;
        }
      }

      // 3. persist metadata (verifies real size from B2).
      const confirmed = await confirmUploadAction({
        name: file.name,
        size: file.size,
        contentType,
        key: plan.key,
      });
      if (confirmed && "revoked" in confirmed) {
        window.location.assign("/login");
        return;
      }

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
