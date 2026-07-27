"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Inbox,
  Send as SendIcon,
  Folder,
  File as FileIcon,
  Layers,
  Copy as CopyIcon,
  Scissors,
  Check,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  History,
} from "lucide-react";
import {
  listReceivedTransfersAction,
  listSentTransfersAction,
  acceptTransferAction,
  declineTransferAction,
  cancelTransferAction,
} from "@/app/(app)/transfers/actions";
import { revalidateDrive } from "@/components/drive/useDriveData";
import { FolderPickerModal } from "@/components/drive/FolderPickerModal";
import { Avatar } from "@/components/shell/Avatar";
import { expiryLabel } from "@/lib/share";
import { formatDateShort } from "@/lib/format-date";
import {
  TRANSFER_STATUS_LABEL,
  type ReceivedTransferView,
  type SentTransferView,
  type TransferStatus,
} from "@/lib/transfer";

type ReceivedRow = ReceivedTransferView & { expiryText: string };
type SentRow = SentTransferView & { expiryText: string };

const STATUS_META: Record<
  TransferStatus,
  { icon: typeof Clock; className: string }
> = {
  pending: { icon: Clock, className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  accepted: {
    icon: CheckCircle2,
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  declined: { icon: XCircle, className: "border-red-500/25 bg-red-500/10 text-red-300" },
  cancelled: { icon: Ban, className: "border-zinc-700/60 bg-zinc-900/60 text-zinc-500" },
  expired: { icon: History, className: "border-zinc-700/60 bg-zinc-900/60 text-zinc-500" },
};

function StatusBadge({ status }: { status: TransferStatus }) {
  const { icon: Icon, className } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      <Icon className="h-3 w-3" />
      {TRANSFER_STATUS_LABEL[status]}
    </span>
  );
}

function ModeBadge({ mode }: { mode: "copy" | "move" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
      {mode === "copy" ? <CopyIcon className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
      {mode === "copy" ? "Copie" : "Mutare"}
    </span>
  );
}

// A live "still pending" chip — pulsing dot + remaining time, matching the
// public share page's expiry pill so the same visual language carries across
// the whole sharing/transfer surface.
function LiveExpiryChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      <Clock className="h-3 w-3" />
      {text}
    </span>
  );
}

function ItemIcon({ folderCount, fileCount }: { folderCount: number; fileCount: number }) {
  const Icon =
    folderCount > 0 && fileCount > 0 ? Layers : folderCount > 0 ? Folder : FileIcon;
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300 shadow-inner">
      <Icon className="h-5 w-5" />
    </span>
  );
}

const cardEnter = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const, delay: Math.min(i, 6) * 0.04 },
  }),
};

export function TransfersBoard() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [received, setReceived] = useState<ReceivedRow[] | null>(null);
  const [sent, setSent] = useState<SentRow[] | null>(null);
  const [accepting, setAccepting] = useState<ReceivedRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadReceived() {
    const res = await listReceivedTransfersAction();
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    const now = Date.now();
    setReceived(res.map((r) => ({ ...r, expiryText: expiryLabel(r.expiresAt, now) })));
  }

  async function loadSent() {
    const res = await listSentTransfersAction();
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    const now = Date.now();
    setSent(res.map((r) => ({ ...r, expiryText: expiryLabel(r.expiresAt, now) })));
  }

  useEffect(() => {
    // Fetch-on-mount; both setters run only after their awaits resolve (not a
    // synchronous cascading render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReceived();
    void loadSent();
  }, []);

  // Live refresh: any change to a transfer involving this user (either side)
  // reloads both lists — e.g. the sender sees "accepted" the instant it happens.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void loadReceived();
        void loadSent();
      }, 250);
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.access_token) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("transfers-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "transfers" }, reload)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function decline(row: ReceivedRow) {
    setBusyId(row.id);
    const res = await declineTransferAction(row.id);
    setBusyId(null);
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Cerere refuzată.");
    void loadReceived();
  }

  async function cancel(row: SentRow) {
    setBusyId(row.id);
    const res = await cancelTransferAction(row.id);
    setBusyId(null);
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Cerere anulată.");
    void loadSent();
  }

  const pendingCount = received?.length ?? 0;

  return (
    <div>
      <div className="mb-5 flex gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("received")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "received" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Inbox className="h-4 w-4" />
          Primite
          {pendingCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold tabular-nums text-white">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("sent")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "sent" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <SendIcon className="h-4 w-4" />
          Trimise
        </button>
      </div>

      {tab === "received" ? (
        received === null ? (
          <Loading />
        ) : received.length === 0 ? (
          <Empty icon={Inbox} text="Nicio cerere primită în așteptare." />
        ) : (
          <ul className="space-y-3.5">
            <AnimatePresence initial={false} mode="popLayout">
              {received.map((row, i) => (
                <motion.li
                  key={row.id}
                  custom={i}
                  variants={cardEnter}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                  layout
                  className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg shadow-black/10 backdrop-blur-sm transition-colors hover:border-zinc-700"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-50/15 to-transparent" />

                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <ItemIcon folderCount={row.folderCount} fileCount={row.fileCount} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-400/80">
                          <Avatar username={row.senderUsername} className="h-4 w-4 text-[9px]" />
                          <span className="normal-case text-sm text-zinc-100">
                            {row.senderUsername}
                          </span>
                          <span className="font-medium normal-case text-zinc-500">
                            vrea să-ți trimită
                          </span>
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold leading-tight text-zinc-50">
                          {row.itemLabel}
                        </h3>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <ModeBadge mode={row.mode} />
                          <LiveExpiryChip text={row.expiryText} />
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2 sm:pl-2">
                      <button
                        type="button"
                        onClick={() => decline(row)}
                        disabled={busyId === row.id}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60 sm:flex-none"
                      >
                        <X className="h-4 w-4" />
                        Refuză
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccepting(row)}
                        disabled={busyId === row.id}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:opacity-60 sm:flex-none"
                      >
                        <Check className="h-4 w-4" />
                        Acceptă
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )
      ) : sent === null ? (
        <Loading />
      ) : sent.length === 0 ? (
        <Empty icon={SendIcon} text="Niciun transfer trimis." />
      ) : (
        <ul className="space-y-3.5">
          <AnimatePresence initial={false} mode="popLayout">
            {sent.map((row, i) => {
              const resolved = row.status !== "pending";
              return (
                <motion.li
                  key={row.id}
                  custom={i}
                  variants={cardEnter}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                  layout
                  className={`relative overflow-hidden rounded-2xl border shadow-lg shadow-black/10 backdrop-blur-sm transition-colors ${
                    resolved
                      ? "border-zinc-800/60 bg-zinc-900/30 opacity-80"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                  }`}
                >
                  {!resolved && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-50/15 to-transparent" />
                  )}

                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <ItemIcon folderCount={row.folderCount} fileCount={row.fileCount} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          <Avatar username={row.recipientUsername} className="h-4 w-4 text-[9px]" />
                          <span className="normal-case text-sm text-zinc-100">
                            {row.recipientUsername}
                          </span>
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold leading-tight text-zinc-50">
                          {row.itemLabel}
                        </h3>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <ModeBadge mode={row.mode} />
                          <StatusBadge status={row.status} />
                          {row.status === "pending" ? (
                            <LiveExpiryChip text={row.expiryText} />
                          ) : (
                            row.resolvedAt && (
                              <span className="text-[11px] text-zinc-600">
                                {TRANSFER_STATUS_LABEL[row.status]} pe{" "}
                                {formatDateShort(row.resolvedAt)}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {row.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => cancel(row)}
                        disabled={busyId === row.id}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
                      >
                        {busyId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Anulează cererea"
                        )}
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {accepting && (
        <FolderPickerModal
          title={`Salvează „${accepting.itemLabel}" în…`}
          onClose={() => setAccepting(null)}
          onPick={async (dest) => {
            const res = await acceptTransferAction(accepting.id, dest);
            if ("revoked" in res) {
              window.location.assign("/login");
              return {};
            }
            if (!res.error) {
              setAccepting(null);
              toast.success("Transfer acceptat — fișierele sunt acum în drive-ul tău.");
              void loadReceived();
              revalidateDrive();
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Inbox; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
}
