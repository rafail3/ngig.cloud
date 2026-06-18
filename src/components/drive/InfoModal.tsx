"use client";

import { X } from "lucide-react";
import { ModalShell } from "./anim";

export type InfoRow = { label: string; value: string };

// Mounted by the parent inside <AnimatePresence> only while open, so `title`/`rows`
// are always present here. `lockScroll={false}` when nested inside another modal
// (e.g. PreviewModal) that already owns the body scroll lock.
export function InfoModal({
  title,
  rows,
  onClose,
  lockScroll = true,
}: {
  title: string;
  rows: InfoRow[];
  onClose: () => void;
  lockScroll?: boolean;
}) {
  return (
    <ModalShell
      onClose={onClose}
      lockScroll={lockScroll}
      className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
    >
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
    </ModalShell>
  );
}
