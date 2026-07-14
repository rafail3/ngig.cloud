"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { CheckCircle2, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/drive/anim";
import {
  closeTicketAction,
  reopenTicketAction,
  deleteTicketAction,
} from "@/app/dashboard/(panel)/tickets/actions";
import type { TicketStatus } from "@/lib/tickets";

export function TicketStatusControls({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleStatus() {
    startTransition(async () => {
      const res = status === "open"
        ? await closeTicketAction(ticketId)
        : await reopenTicketAction(ticketId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(status === "open" ? "Ticket închis." : "Ticket redeschis.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteTicketAction(ticketId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ticket șters.");
      router.push("/tickets");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleStatus}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 ${
          status === "open"
            ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
        }`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === "open" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        {status === "open" ? "Închide ticketul" : "Redeschide"}
      </button>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" /> Șterge
      </button>

      <AnimatePresence>
        {confirmDelete && (
          <ModalShell key="del" onClose={() => setConfirmDelete(false)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">Ștergi ticketul?</h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Ticketul, toate mesajele și atașamentele lui vor fi șterse definitiv.
              Acțiunea e ireversibilă.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-60"
              >
                {pending ? "Se șterge…" : "Șterge definitiv"}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}
