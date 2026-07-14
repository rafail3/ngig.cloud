"use client";

import { useCallback, useEffect, useRef } from "react";
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
  const contentRef = useRef<HTMLDivElement>(null);
  // Whether the view should stick to the bottom. False once the user scrolls up
  // to read history — we must not yank them back down.
  const pinned = useRef(true);

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // New message (or first paint) → jump to the newest.
  useEffect(() => {
    pinned.current = true;
    toBottom();
  }, [messages.length, toBottom]);

  // Images and videos finish loading AFTER the scroll above ran, growing the
  // content and leaving the view a message or two short. Re-pin as the content
  // resizes so the bottom stays the bottom.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(() => {
      if (pinned.current) toBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [toBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // ~1 line of slack, so "almost at the bottom" still counts as pinned.
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  return (
    <>
      <div className="chat-surface relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-800/70">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto px-3 py-3 sm:px-4"
        >
          <div ref={contentRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
      </div>

      <div className="shrink-0 pt-3">{children}</div>
    </>
  );
}
