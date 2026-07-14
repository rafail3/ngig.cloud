"use client";

import { useState } from "react";
import { Paperclip, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/format-date";
import { getAttachmentUrlAction } from "@/app/(app)/support/actions";
import type { TicketMessage } from "@/server/tickets/service";

// Downloadable attachment chip. Resolves a presigned URL on click (RLS-gated),
// then navigates to it. Shared by user + admin threads.
function AttachmentChip({ id, name, size }: { id: string; name: string; size: number }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const res = await getAttachmentUrlAction(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.location.assign(res.url);
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-left text-sm transition hover:border-zinc-700 hover:bg-zinc-950/70 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      )}
      <span className="truncate text-zinc-200">{name}</span>
      <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatBytes(size)}</span>
      <Download className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:text-zinc-300" />
    </button>
  );
}

// The message thread. `viewerIsAdmin` decides which side is "mine" (right,
// accented) vs "them" (left) so the same component serves both surfaces.
export function TicketMessages({
  messages,
  viewerIsAdmin,
  authorName,
}: {
  messages: TicketMessage[];
  viewerIsAdmin: boolean;
  // Name shown on the counterpart's messages (the ticket owner, for admins).
  authorName: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = m.from_admin === viewerIsAdmin;
        const who = m.from_admin ? "Suport ngig.cloud" : authorName;
        return (
          <div key={m.id} className={`flex flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl border px-3.5 py-2.5 ${
                mine
                  ? "border-indigo-500/30 bg-indigo-500/10"
                  : "border-zinc-800/70 bg-zinc-900/50"
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-100">{m.body}</p>
              {m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.attachments.map((a) => (
                    <AttachmentChip key={a.id} id={a.id} name={a.name} size={a.size} />
                  ))}
                </div>
              )}
            </div>
            <p className="px-1 text-[11px] text-zinc-500">
              {who} · {formatDateTime(m.created_at)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
