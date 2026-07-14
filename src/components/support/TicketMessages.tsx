"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Check, Paperclip, Play } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatTime, dayKey, formatDayLabel } from "@/lib/format-date";
import { MediaLightbox } from "./MediaLightbox";
import type { TicketMessage, TicketAttachment } from "@/server/tickets/service";

// Messages that fall on the same Romanian calendar day share one divider.
type DayGroup = { key: string; label: string; items: TicketMessage[] };

function groupByDay(messages: TicketMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const m of messages) {
    const key = dayKey(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(m);
    else groups.push({ key, label: formatDayLabel(m.created_at), items: [m] });
  }
  return groups;
}

// Non-media leftovers (nothing new can be uploaded that isn't image/video).
function FileChip({ name, size }: { name: string; size: number }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-sm">
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <span className="truncate text-zinc-200">{name}</span>
      <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatBytes(size)}</span>
    </span>
  );
}

function Media({
  item,
  onOpen,
}: {
  item: TicketAttachment;
  onOpen: (a: TicketAttachment) => void;
}) {
  if (item.kind === "image") {
    return (
      <button
        type="button"
        onClick={() => onOpen(item)}
        title={item.name}
        className="block overflow-hidden rounded-xl border border-zinc-800/60 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
      >
        {/* Presigned B2 URLs rotate host/signature — next/image remotePatterns
            can't cover them; a plain img is the right call here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.name}
          loading="lazy"
          className="max-h-64 w-auto max-w-full object-cover"
        />
      </button>
    );
  }

  if (item.kind === "video") {
    return (
      <button
        type="button"
        onClick={() => onOpen(item)}
        title={item.name}
        className="group relative block overflow-hidden rounded-xl border border-zinc-800/60 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
      >
        {/* metadata-only preload: a poster frame without pulling the whole file */}
        <video
          src={`${item.url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="max-h-64 w-auto max-w-full"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        </span>
      </button>
    );
  }

  return <FileChip name={item.name} size={item.size} />;
}

export function TicketMessages({
  messages,
  viewerIsAdmin,
  authorName,
}: {
  messages: TicketMessage[];
  viewerIsAdmin: boolean;
  // Name shown on the counterpart's messages (the ticket owner, for admins).
  authorName: string;
}) {
  const [lightbox, setLightbox] = useState<TicketAttachment | null>(null);
  const groups = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2.5">
          {/* Floats at the top of the scroll area while its day is on screen. */}
          <div className="sticky top-0 z-10 flex justify-center py-0.5">
            <span className="rounded-full border border-zinc-800/80 bg-zinc-900/90 px-3 py-1 text-xs font-medium text-zinc-400 shadow-sm backdrop-blur">
              {g.label}
            </span>
          </div>

          {g.items.map((m) => {
            const mine = m.from_admin === viewerIsAdmin;
            const who = m.from_admin ? "Suport ngig.cloud" : authorName;
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[75%] ${
                    mine
                      ? "border-indigo-500/30 bg-indigo-500/10"
                      : "border-zinc-800/70 bg-zinc-900/80"
                  }`}
                >
                  {m.body && (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100">
                      {m.body}
                    </p>
                  )}
                  {m.attachments.length > 0 && (
                    <div className={`flex flex-col gap-1.5 ${m.body ? "mt-2" : ""}`}>
                      {m.attachments.map((a) => (
                        <Media key={a.id} item={a} onOpen={setLightbox} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Hour only — the day lives in the divider above the group. */}
                <p className="flex items-center gap-1 px-1 text-[13px] text-zinc-500">
                  {!mine && <span>{who} ·</span>}
                  <span>{formatTime(m.created_at)}</span>
                  {mine && (
                    <Check className="h-3.5 w-3.5 text-zinc-500" aria-label="Trimis" />
                  )}
                </p>
              </div>
            );
          })}
        </div>
      ))}

      <AnimatePresence>
        {lightbox && (
          <MediaLightbox key="lightbox" item={lightbox} onClose={() => setLightbox(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
