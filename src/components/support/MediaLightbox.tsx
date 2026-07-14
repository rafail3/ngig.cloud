"use client";

import { useState } from "react";
import { Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/drive/anim";
import { getAttachmentUrlAction } from "@/app/(app)/support/actions";
import type { TicketAttachment } from "@/server/tickets/service";

// Full-size viewer for a ticket attachment. Opens from a thumbnail in the chat
// so media is inspectable without downloading; the download stays one click
// away (that link is presigned with an attachment disposition).
export function MediaLightbox({
  item,
  onClose,
}: {
  item: TicketAttachment;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    const res = await getAttachmentUrlAction(item.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.location.assign(res.url);
  }

  return (
    <ModalShell
      onClose={onClose}
      scrim="bg-black/85"
      className="max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1.5">
        <p className="min-w-0 truncate text-sm text-zinc-300">{item.name}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={download}
            disabled={busy}
            aria-label="Descarcă"
            title="Descarcă"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-xl bg-black/40">
        {item.kind === "video" ? (
          <video
            src={item.url}
            controls
            autoPlay
            className="max-h-[80vh] w-auto max-w-full"
          />
        ) : (
          // Presigned B2 URLs are short-lived and host-dynamic — next/image would
          // need remotePatterns for a host that rotates; a plain img is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.name}
            className="max-h-[80vh] w-auto max-w-full object-contain"
          />
        )}
      </div>
    </ModalShell>
  );
}
