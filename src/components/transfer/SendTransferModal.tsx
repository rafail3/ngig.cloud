"use client";

import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import { ModalShell } from "@/components/drive/anim";
import { SendTransferPanel } from "./SendTransferPanel";
import type { UserSearchResult } from "@/lib/transfer";
import type { ShareTargetType } from "@/lib/share";

// Standalone shell around SendTransferPanel, for the entry points that AREN'T
// the share modal (a user's profile, the /transfers page). The share modal
// keeps rendering the panel inside its own tabbed shell — this only supplies
// the chrome the panel doesn't own.
export function SendTransferModal({
  targets = null,
  initialRecipients = [],
  subtitle,
  onClose,
}: {
  targets?: { type: ShareTargetType; id: string }[] | null;
  initialRecipients?: UserSearchResult[];
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <ModalShell
      onClose={onClose}
      className="max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300">
            <Send className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
              Trimite
            </h3>
            <p className="truncate text-xs text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <Button variant="unstyled"
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="shrink-0 rounded p-1 text-zinc-400 transition hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <SendTransferPanel
        targets={targets}
        initialRecipients={initialRecipients}
        onClose={onClose}
      />
    </ModalShell>
  );
}
