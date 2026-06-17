"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export type InfoRow = { label: string; value: string };

export function InfoModal({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: InfoRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-all text-base font-semibold text-zinc-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="shrink-0 rounded p-1 text-zinc-400 transition hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-zinc-500">{r.label}</dt>
              <dd className="min-w-0 break-all text-right text-zinc-200">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
