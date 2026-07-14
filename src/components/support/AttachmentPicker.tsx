"use client";

import { useRef } from "react";
import { ImagePlus, X, Film, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";
import {
  TICKET_MAX_ATTACHMENTS,
  TICKET_ACCEPT,
  checkAttachment,
  attachmentKind,
} from "@/lib/tickets";

// Controlled media picker: the parent owns the File[] and uploads them at submit
// time (see uploadTicketFile). Images and videos only, capped per kind, with a
// clear toast; the server re-checks everything.
export function AttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function add(picked: FileList | null) {
    if (!picked) return;
    const incoming = Array.from(picked);
    const next = [...files];
    for (const f of incoming) {
      const problem = checkAttachment(f);
      if (problem) {
        toast.error(problem);
        continue;
      }
      if (next.length >= TICKET_MAX_ATTACHMENTS) {
        toast.error(`Maxim ${TICKET_MAX_ATTACHMENTS} atașamente.`);
        break;
      }
      next.push(f);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={TICKET_ACCEPT}
        disabled={disabled}
        onChange={(e) => add(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= TICKET_MAX_ATTACHMENTS}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-50"
      >
        <ImagePlus className="h-4 w-4" />
        Adaugă imagini sau video
      </button>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                {attachmentKind(f.type) === "video" ? (
                  <Film className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                )}
                <span className="truncate text-zinc-200">{f.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {formatBytes(f.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={`Elimină ${f.name}`}
                className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:text-zinc-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
