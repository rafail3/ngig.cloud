"use client";

import { useState } from "react";
import { Send, Copy as CopyIcon, Scissors, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createTransferAction } from "@/app/(app)/transfers/actions";
import { UserSearchInput } from "./UserSearchInput";
import type { UserSearchResult, TransferMode } from "@/lib/transfer";
import type { ShareTargetType } from "@/lib/share";

type Target = { type: ShareTargetType; id: string };

// The "Trimite utilizator" panel inside the share modal: pick a recipient by
// live username search, choose copy (default) or move, and send. The recipient
// must accept before anything actually lands in their drive.
export function SendTransferPanel({
  targets,
  onClose,
}: {
  targets: Target[];
  onClose: () => void;
}) {
  const [recipient, setRecipient] = useState<UserSearchResult | null>(null);
  const [mode, setMode] = useState<TransferMode>("copy");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!recipient) {
      toast.error("Alege un destinatar.");
      return;
    }
    setBusy(true);
    const res = await createTransferAction({ targets, recipientId: recipient.id, mode });
    setBusy(false);
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-5 flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-zinc-100">
          Cerere trimisă către {recipient?.username}
        </p>
        <p className="max-w-xs text-xs text-zinc-500">
          {recipient?.username} trebuie să accepte cererea înainte ca fișierele
          să ajungă la el. Vezi statusul în „Transferuri”.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          Închide
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Destinatar
        </p>
        <UserSearchInput
          selected={recipient}
          onSelect={setRecipient}
          onClear={() => setRecipient(null)}
        />
      </div>

      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Mod
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("copy")}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === "copy"
                ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-950/40"
                : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <CopyIcon className="h-4 w-4" />
            Copie
          </button>
          <button
            type="button"
            onClick={() => setMode("move")}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === "move"
                ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-950/40"
                : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Scissors className="h-4 w-4" />
            Mută definitiv
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {mode === "copy"
            ? "Rămâi cu originalul; destinatarul primește o copie."
            : "La acceptare, elementele dispar din contul tău și trec definitiv la destinatar."}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          Anulează
        </button>
        <button
          type="button"
          onClick={send}
          disabled={busy || !recipient}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Se trimite…" : "Trimite"}
        </button>
      </div>
    </div>
  );
}
