"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { closeMyTicketAction } from "@/app/(app)/support/actions";

// Lets the owner close a ticket they no longer need help with. Not destructive
// — replying reopens it — so no confirm dialog.
export function CloseMyTicket({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function close() {
    startTransition(async () => {
      const res = await closeMyTicketAction(ticketId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ticket închis. Poți să-l redeschizi oricând răspunzând.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={close}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {pending ? "Se închide…" : "Marchează rezolvat"}
    </button>
  );
}
