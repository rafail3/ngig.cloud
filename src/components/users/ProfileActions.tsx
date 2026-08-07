"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { SendTransferModal } from "@/components/transfer/SendTransferModal";
import type { PublicProfile } from "@/lib/users";

// What you can do with another user, from their profile. Sending opens the
// shared transfer flow with this person already filled in — the files get
// picked inside it.
export function ProfileActions({ profile }: { profile: PublicProfile }) {
  const [sending, setSending] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="unstyled"
          type="button"
          onClick={() => setSending(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-500"
        >
          <Send className="h-4 w-4" />
          Trimite fișiere
        </Button>
        {/* Deliberately disabled rather than hidden: the slot is real and
            arriving, and a visible-but-honest control beats a button that
            promises something it can't do yet. */}
        <Button variant="unstyled"
          type="button"
          disabled
          title="Mesageria directă vine în curând."
          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-500 opacity-60"
        >
          <MessageSquare className="h-4 w-4" />
          Mesaj
          <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            În curând
          </span>
        </Button>
      </div>

      {sending && (
        <SendTransferModal
          initialRecipients={[{ id: profile.id, username: profile.username }]}
          subtitle={`Către ${profile.username}`}
          onClose={() => setSending(false)}
        />
      )}
    </>
  );
}
