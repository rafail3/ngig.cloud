"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flag } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/support/Select";
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
    <Select
      value={priority}
      options={TICKET_PRIORITIES}
      onChange={change}
      disabled={pending}
      icon={pending ? Loader2 : Flag}
      ariaLabel="Prioritate"
      className="w-44"
      renderLabel={(l) => `Prioritate: ${l}`}
    />
  );
}
