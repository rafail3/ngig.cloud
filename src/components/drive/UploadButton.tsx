"use client";

import { useRef } from "react";
import { useUploads } from "./UploadProvider";

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { jobs, enqueue } = useUploads();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) enqueue(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Inline summary for the files currently in flight.
  const active = jobs.filter(
    (j) => j.status === "uploading" || j.status === "queued",
  );
  const totalSize = active.reduce((s, j) => s + j.size, 0);
  const totalSent = active.reduce((s, j) => s + j.sent, 0);
  const pct = totalSize > 0 ? Math.round((totalSent / totalSize) * 100) : 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400"
      >
        Upload
      </button>
      {active.length > 0 && (
        <span className="text-xs text-zinc-400">
          Se încarcă {active.length}{" "}
          {active.length === 1 ? "fișier" : "fișiere"} · {pct}%
        </span>
      )}
    </div>
  );
}
