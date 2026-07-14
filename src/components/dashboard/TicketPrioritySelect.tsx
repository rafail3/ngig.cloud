"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flag } from "lucide-react";
import { toast } from "sonner";
import { setPriorityAction } from "@/app/dashboard/(panel)/tickets/actions";
import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/tickets";

// Admin-only priority override. The user picks a priority when opening the
// ticket; from then on only an admin can change it.
export function TicketPrioritySelect({
  ticketId,
  priority,
}: {
  ticketId: string;
  priority: TicketPriority;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === priority) return;
    startTransition(async () => {
      const res = await setPriorityAction(ticketId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prioritate actualizată.");
      router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">Prioritate</span>
      {pending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" />
      ) : (
        <Flag className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
      )}
      <select
        value={priority}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-1.5 text-sm text-zinc-200 outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60"
      >
        {TICKET_PRIORITIES.map((p) => (
          <option key={p.key} value={p.key}>
            Prioritate: {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
