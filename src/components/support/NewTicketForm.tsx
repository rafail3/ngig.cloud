"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Shapes, Flag } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPicker } from "./AttachmentPicker";
import { Select } from "./Select";
import { uploadTicketFile } from "./ticket-upload";
import { createTicketAction } from "@/app/(app)/support/actions";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_MAX_SUBJECT,
  type IncomingAttachment,
} from "@/lib/tickets";

const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const fieldCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3.5 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15";

export function NewTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0].key);
  const [priority, setPriority] = useState("medium");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return toast.error("Adaugă un subiect.");
    if (!body.trim()) return toast.error("Descrie problema.");

    setUploading(true);
    let attachments: IncomingAttachment[] = [];
    try {
      attachments = await Promise.all(files.map(uploadTicketFile));
    } catch (err) {
      setUploading(false);
      return toast.error(err instanceof Error ? err.message : "Încărcarea a eșuat.");
    }
    setUploading(false);

    startTransition(async () => {
      const res = await createTicketAction({
        subject: subject.trim(),
        category,
        priority,
        body: body.trim(),
        attachments,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Clear the draft before leaving: this page stays mounted in the client
      // router cache, so without this the next "Ticket nou" would open
      // pre-filled with what was just submitted.
      setSubject("");
      setBody("");
      setFiles([]);
      setCategory(TICKET_CATEGORIES[0].key);
      setPriority("medium");
      toast.success("Ticket deschis.");
      router.push(`/support/${res.id}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5"
    >
      <div>
        <label htmlFor="subject" className={labelCls}>Subiect</label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={TICKET_MAX_SUBJECT}
          placeholder="Descrie pe scurt problema"
          className={fieldCls}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Categorie</span>
          <Select
            value={category}
            options={TICKET_CATEGORIES}
            onChange={setCategory}
            icon={Shapes}
            ariaLabel="Categorie"
          />
        </div>
        <div>
          <span className={labelCls}>Prioritate</span>
          <Select
            value={priority}
            options={TICKET_PRIORITIES}
            onChange={setPriority}
            icon={Flag}
            ariaLabel="Prioritate"
          />
        </div>
      </div>

      <div>
        <label htmlFor="body" className={labelCls}>Mesaj</label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Spune-ne cât mai multe detalii — ce ai încercat, ce ai văzut, pași de reproducere…"
          className={`${fieldCls} resize-y`}
        />
      </div>

      <div>
        <span className={labelCls}>Atașamente <span className="font-normal text-zinc-500">(opțional)</span></span>
        <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {uploading ? "Se încarcă…" : pending ? "Se trimite…" : "Trimite ticketul"}
        </button>
      </div>
    </form>
  );
}
