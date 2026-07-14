"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPicker } from "./AttachmentPicker";
import { uploadTicketFile } from "./ticket-upload";
import type { IncomingAttachment } from "@/lib/tickets";

type SendResult = { ok: true } | { ok: false; error: string };

// Reply composer shared by the user and admin thread views. The parent supplies
// the server action (`onSend`); this handles uploading attachments first, then
// sending, with pending state + toasts.
export function TicketComposer({
  onSend,
  placeholder = "Scrie un răspuns…",
  hint,
}: {
  onSend: (body: string, attachments: IncomingAttachment[]) => Promise<SendResult>;
  placeholder?: string;
  hint?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function submit() {
    const text = body.trim();
    if (!text) {
      toast.error("Scrie un mesaj.");
      return;
    }
    setUploading(true);
    let attachments: IncomingAttachment[] = [];
    try {
      attachments = await Promise.all(files.map(uploadTicketFile));
    } catch (e) {
      setUploading(false);
      toast.error(e instanceof Error ? e.message : "Încărcarea a eșuat.");
      return;
    }
    setUploading(false);

    startTransition(async () => {
      const res = await onSend(text, attachments);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      setFiles([]);
      toast.success("Mesaj trimis.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={busy}
        className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15"
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {uploading ? "Se încarcă…" : pending ? "Se trimite…" : "Trimite"}
        </button>
      </div>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
