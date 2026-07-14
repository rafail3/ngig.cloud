"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { TicketMessages } from "./TicketMessages";
import type { TicketMessage } from "@/server/tickets/service";

// Messaging-app frame: the thread scrolls inside its own bounded surface while
// the composer (passed as children) stays pinned at the bottom of the viewport.
// The parent page supplies the fixed-height flex column this relies on.
export function ChatPanel({
  messages,
  viewerIsAdmin,
  authorName,
  children,
}: {
  messages: TicketMessage[];
  viewerIsAdmin: boolean;
  authorName: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Land on the newest message, and follow along as replies arrive (realtime
  // re-renders the server component, which changes the message count).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <>
      <div className="chat-surface relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-800/70">
        <div ref={scrollRef} className="h-full overflow-y-auto px-3 py-3 sm:px-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
                <MessageSquare className="h-5 w-5 text-zinc-500" aria-hidden="true" />
              </span>
              <p className="text-sm text-zinc-500">Niciun mesaj încă.</p>
            </div>
          ) : (
            <TicketMessages
              messages={messages}
              viewerIsAdmin={viewerIsAdmin}
              authorName={authorName}
            />
          )}
        </div>
      </div>

      <div className="shrink-0 pt-3">{children}</div>
    </>
  );
}
