"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { SharePreviewKind } from "@/lib/share";
import { SharePreviewModal } from "./SharePreviewModal";

// "Previzualizează" for a single shared file — opens the preview in a pop-up
// lightbox (not an inline dropdown).
export function SharePreviewButton({
  url,
  kind,
  name,
}: {
  url: string;
  kind: Exclude<SharePreviewKind, null>;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <Eye className="h-4 w-4" aria-hidden /> Previzualizează
      </button>
      <SharePreviewModal
        target={open ? { url, kind, name } : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
