"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Inbox,
  Send as SendIcon,
  Folder,
  File as FileIcon,
  Copy as CopyIcon,
  Scissors,
  Check,
  X,
  Loader2,
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
import {
  TRANSFER_STATUS_LABEL,
  type ReceivedTransferView,
  type SentTransferView,
  type TransferStatus,
} from "@/lib/transfer";

type ReceivedRow = ReceivedTransferView & { expiryText: string };
type SentRow = SentTransferView & { expiryText: string };

const STATUS_STYLE: Record<TransferStatus, string> = {
  pending: "border-amber-500/20 bg-amber-500/5 text-amber-300",
  accepted: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
  declined: "border-red-500/20 bg-red-500/5 text-red-300",
  cancelled: "border-zinc-800 bg-zinc-950/50 text-zinc-500",
  expired: "border-zinc-800 bg-zinc-950/50 text-zinc-500",
};

function ModeBadge({ mode }: { mode: "copy" | "move" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
      {mode === "copy" ? <CopyIcon className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
      {mode === "copy" ? "Copie" : "Mutare"}
    </span>
  );
}

function ItemIcon({ folderCount, fileCount }: { folderCount: number; fileCount: number }) {
  const Icon = folderCount > 0 && fileCount === 0 ? Folder : FileIcon;
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300">
      <Icon className="h-5 w-5" />
    </span>
  );
}

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
      <div className="mb-5 flex gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1.5">
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
          <Empty text="Nicio cerere primită în așteptare." />
        ) : (
          <ul className="space-y-3">
            {received.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <ItemIcon folderCount={row.folderCount} fileCount={row.fileCount} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                      <Avatar username={row.senderUsername} className="h-5 w-5 text-[10px]" />
                      {row.senderUsername}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-zinc-400">
                      vrea să-ți trimită {row.itemLabel}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ModeBadge mode={row.mode} />
                      <span className="text-[11px] text-zinc-600">{row.expiryText}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => decline(row)}
                    disabled={busyId === row.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Refuză
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccepting(row)}
                    disabled={busyId === row.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    Acceptă
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : sent === null ? (
        <Loading />
      ) : sent.length === 0 ? (
        <Empty text="Niciun transfer trimis." />
      ) : (
        <ul className="space-y-3">
          {sent.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <ItemIcon folderCount={row.folderCount} fileCount={row.fileCount} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                    <Avatar username={row.recipientUsername} className="h-5 w-5 text-[10px]" />
                    {row.recipientUsername}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-zinc-400">{row.itemLabel}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ModeBadge mode={row.mode} />
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[row.status]}`}
                    >
                      {TRANSFER_STATUS_LABEL[row.status]}
                    </span>
                    {row.status === "pending" && (
                      <span className="text-[11px] text-zinc-600">{row.expiryText}</span>
                    )}
                  </div>
                </div>
                {row.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => cancel(row)}
                    disabled={busyId === row.id}
                    className="shrink-0 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
                  >
                    Anulează
                  </button>
                )}
              </div>
            </li>
          ))}
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
}
