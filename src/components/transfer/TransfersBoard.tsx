"use client";

import { Button } from "@/components/ui/button";
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
  ArrowRightLeft,
  Check,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  History,
  FolderOpen,
  Plus,
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
import { TransferContentsModal } from "@/components/transfer/TransferContentsModal";
import { SendTransferModal } from "@/components/transfer/SendTransferModal";
import { Avatar } from "@/components/shell/Avatar";
import { expiryLabel } from "@/lib/share";
import { formatDateShort } from "@/lib/format-date";
import {
  TRANSFER_STATUS_LABEL,
  transferTitle,
  type ReceivedTransferView,
  type SentTransferView,
  type TransferStatus,
  type TransferMode,
} from "@/lib/transfer";
import { FileTypeIcon } from "@/components/drive/FileTypeIcon";

type ReceivedRow = ReceivedTransferView & { expiryText: string };
type SentRow = SentTransferView & { expiryText: string };

// Under a day left — the expiry line turns amber. Read at render time from the
// already-fetched timestamp, so it stays honest as the page sits open.
const URGENT_MS = 24 * 60 * 60 * 1000;
function isUrgent(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() - Date.now() < URGENT_MS;
}

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
  cancelled: { icon: Ban, className: "border-zinc-700/60 bg-zinc-900/60 text-zinc-300" },
  expired: { icon: History, className: "border-zinc-700/60 bg-zinc-900/60 text-zinc-300" },
};

// Opens TransferContentsModal — shown only on pending transfers (either tab),
// where the sender's original items still exist to browse. Sits in the same
// action band as Refuză/Acceptă, styled one step quieter than them.
function ViewContentsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="unstyled"
      type="button"
      onClick={onClick}
      title="Vezi conținutul"
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-400 transition hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-300"
    >
      <FolderOpen className="h-4 w-4" />
      <span className="hidden lg:inline">Conținut</span>
    </Button>
  );
}

// Bytes copied so far vs. the total, streamed in via Realtime while
// acceptTransfer is actively running — replaces the action buttons for as
// long as it's in flight, on BOTH sides (recipient watches their own accept,
// sender can watch a recipient's acceptance happen live too).
function TransferProgressBar({ done, total }: { done: number; total: number | null }) {
  const indeterminate = total == null;
  const pct = indeterminate
    ? 0
    : total > 0
      ? Math.min(100, Math.round((done / total) * 100))
      : 100;
  return (
    <div className="mt-3 w-full">
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-indigo-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          {indeterminate ? "Se pregătește…" : "Se copiază…"}
        </span>
        {!indeterminate && (
          <span className="font-semibold tabular-nums text-zinc-300">{pct}%</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={`h-full rounded-full bg-indigo-500 ${indeterminate ? "animate-pulse" : ""}`}
          initial={{ width: 0 }}
          animate={{ width: indeterminate ? "35%" : `${pct}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Transient success state shown right after THIS client's own accept
// resolves — a real checkmark instead of the row just silently vanishing
// once the reload catches up with the now-"accepted" status.
function CompletedRow({ itemLabel }: { itemLabel: string }) {
  return (
    <motion.li
      key="completed"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      layout
      className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/10 shadow-lg shadow-black/10"
    >
      <div className="flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold leading-tight text-zinc-50">{itemLabel}</h3>
          <p className="mt-1 text-sm font-medium text-emerald-300">
            Transfer finalizat — fișierele sunt acum în drive-ul tău.
          </p>
        </div>
      </div>
    </motion.li>
  );
}

// A single file shows its real drive icon (same component, same colour coding as
// the file list) so it's recognisable at a glance; folders and mixed bundles get
// a matching chip in the same box.
function TransferIcon({
  folderCount,
  fileCount,
  firstName,
}: {
  folderCount: number;
  fileCount: number;
  firstName: string | undefined;
}) {
  const singleFile = folderCount === 0 && fileCount === 1 && firstName;
  if (singleFile) return <FileTypeIcon name={firstName} size="sm" />;

  const Icon = folderCount > 0 && fileCount > 0 ? Layers : folderCount > 0 ? Folder : FileIcon;
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/* The transfer card, shared by both tabs.

   Hierarchy fix: the NAME of what's being sent leads, because that's what the
   user recognises — the old card made "1 folder" the largest text, which is a
   count, not information, and forced a click into "Vezi conținutul" just to
   learn which folder it was. Everything else (who, mode, expiry) collapses into
   one dot-separated meta line instead of a row of competing chips, and all
   actions live in a single band rather than being scattered over two levels. */
function TransferCard({
  title,
  counterpartPrefix,
  counterpartUsername,
  mode,
  folderCount,
  fileCount,
  firstName,
  expiryText,
  urgent,
  itemLabel,
  progress,
  actions,
  index,
}: {
  title: string;
  counterpartPrefix: string;
  counterpartUsername: string;
  mode: TransferMode;
  folderCount: number;
  fileCount: number;
  firstName: string | undefined;
  expiryText: string;
  urgent: boolean;
  itemLabel: string;
  progress: { done: number; total: number | null } | null;
  actions: React.ReactNode;
  index: number;
}) {
  // No overflow-hidden on the card: nothing needs clipping now that the
  // hairline is gone, and it only risked cutting glyphs mid layout-animation.
  return (
    <motion.li
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      layout
      className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TransferIcon
            folderCount={folderCount}
            fileCount={fileCount}
            firstName={firstName}
          />
          <div className="min-w-0 flex-1">
            {/* leading-6, not leading-snug: `truncate` clips at the line box,
                and a tight line-height cuts the marks on ă/î/ș/ț. */}
            <p className="truncate text-[15px] font-semibold leading-6 text-zinc-50">
              {title}
            </p>
            {/* One meta line, not a chip row: who → what kind → how long left.
                zinc-400 is the floor here: this line carries real information,
                and zinc-500/600 on this surface land at ~3.9:1 and ~2.4:1,
                under the 4.5:1 minimum. Emphasis comes from weight and colour
                temperature, never from dimming the supporting words. */}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-5 text-zinc-400">
              <span>{counterpartPrefix}</span>
              <Avatar username={counterpartUsername} className="h-4 w-4 text-[9px]" />
              <span className="font-medium text-zinc-100">{counterpartUsername}</span>
              <Dot />
              <span className="inline-flex items-center gap-1">
                {mode === "copy" ? (
                  <CopyIcon className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                )}
                {mode === "copy" ? "Copie" : "Mutare"}
              </span>
              <Dot />
              <span>{itemLabel}</span>
              <Dot />
              {/* Colour follows urgency, and the word "Expiră" carries the
                  meaning either way — never colour alone. */}
              <span
                className={`inline-flex items-center gap-1 ${
                  urgent ? "font-medium text-amber-400" : ""
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {expiryText}
              </span>
            </p>
            {progress && (
              <TransferProgressBar done={progress.done} total={progress.total} />
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-2 sm:pl-2">{actions}</div>
        )}
      </div>
    </motion.li>
  );
}

// Decorative separator only, so it may sit below text contrast — but zinc-700
// was invisible against the card. zinc-600 reads as a separator without
// competing with the words either side.
function Dot() {
  return (
    <span aria-hidden className="text-zinc-600">
      ·
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
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [completedRow, setCompletedRow] = useState<ReceivedRow | null>(null);
  const [viewing, setViewing] = useState<{ id: string; itemLabel: string } | null>(null);
  const [composing, setComposing] = useState(false);
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

  // Runs after FolderPickerModal already closed (see below) — decoupled from
  // its lifecycle so a long copy never leaves it frozen open with no feedback.
  async function startAccept(row: ReceivedRow, dest: string | null) {
    setAcceptingId(row.id);
    const res = await acceptTransferAction(row.id, dest);
    setAcceptingId(null);
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    if (res.error) {
      toast.error(res.error);
      void loadReceived();
      return;
    }
    revalidateDrive();
    setCompletedRow(received?.find((r) => r.id === row.id) ?? row);
    window.setTimeout(() => {
      setCompletedRow(null);
      void loadReceived();
    }, 1100);
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
      {/* Sending starts here too, not only from a file's "Partajează" menu —
          you pick the files inside the modal instead. */}
      <div className="mb-4 flex justify-end">
        <Button variant="unstyled"
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-500 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Trimite fișiere
        </Button>
      </div>

      <div className="mb-5 flex gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1.5 shadow-sm">
        <Button variant="unstyled"
          type="button"
          onClick={() => setTab("received")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "received" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <Inbox className="h-4 w-4" />
          Primite
          {pendingCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold tabular-nums text-white">
              {pendingCount}
            </span>
          )}
        </Button>
        <Button variant="unstyled"
          type="button"
          onClick={() => setTab("sent")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "sent" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <SendIcon className="h-4 w-4" />
          Trimise
        </Button>
      </div>

      {tab === "received" ? (
        received === null ? (
          <Loading />
        ) : received.length === 0 && !completedRow ? (
          <Empty icon={Inbox} text="Nicio cerere primită în așteptare." />
        ) : (
          <ul className="space-y-3.5">
            <AnimatePresence initial={false} mode="popLayout">
              {completedRow && (
                <CompletedRow key="completed" itemLabel={completedRow.itemLabel} />
              )}
              {received
                .filter((r) => r.id !== completedRow?.id)
                .map((row, i) => {
                  const inProgress = row.id === acceptingId || row.progressTotal != null;
                  return (
                    <TransferCard
                      key={row.id}
                      index={i}
                      title={transferTitle(row.itemNames, row.folderCount, row.fileCount)}
                      counterpartPrefix="de la"
                      counterpartUsername={row.senderUsername}
                      mode={row.mode}
                      folderCount={row.folderCount}
                      fileCount={row.fileCount}
                      firstName={row.itemNames[0]}
                      expiryText={row.expiryText}
                      urgent={isUrgent(row.expiresAt)}
                      itemLabel={row.itemLabel}
                      progress={
                        inProgress
                          ? { done: row.progressDone, total: row.progressTotal }
                          : null
                      }
                      actions={
                        inProgress ? null : (
                          <>
                            <ViewContentsButton
                              onClick={() =>
                                setViewing({ id: row.id, itemLabel: row.itemLabel })
                              }
                            />
                            <Button variant="unstyled"
                              type="button"
                              onClick={() => decline(row)}
                              disabled={busyId === row.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
                            >
                              <X className="h-4 w-4" />
                              Refuză
                            </Button>
                            <Button variant="unstyled"
                              type="button"
                              onClick={() => setAccepting(row)}
                              disabled={busyId === row.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:opacity-60"
                            >
                              <Check className="h-4 w-4" />
                              Acceptă
                            </Button>
                          </>
                        )
                      }
                    />
                  );
                })}
            </AnimatePresence>
          </ul>
        )
      ) : sent === null ? (
        <Loading />
      ) : sent.length === 0 ? (
        <Empty icon={SendIcon} text="Niciun transfer trimis." />
      ) : (
        <SentList
          rows={sent}
          busyId={busyId}
          onCancel={cancel}
          onViewContents={(row) => setViewing({ id: row.id, itemLabel: row.itemLabel })}
        />
      )}

      {accepting && (
        <FolderPickerModal
          title={`Salvează „${accepting.itemLabel}" în…`}
          onClose={() => setAccepting(null)}
          onPick={async (dest) => {
            // Close the picker immediately and hand off to startAccept, which
            // runs independently — a big file/folder can take a while, and
            // freezing the modal open with no feedback is exactly the "ghost
            // card" behavior this progress bar replaces.
            const row = accepting;
            setAccepting(null);
            void startAccept(row, dest);
            return {};
          }}
        />
      )}

      {viewing && (
        <TransferContentsModal
          transferId={viewing.id}
          title={viewing.itemLabel}
          onClose={() => setViewing(null)}
        />
      )}

      {composing && (
        <SendTransferModal
          subtitle="Alege ce trimiți și cui"
          onClose={() => {
            setComposing(false);
            void loadSent();
          }}
        />
      )}
    </div>
  );
}

/* The "Trimise" list.

   Spatial thesis: what is ACTIONABLE outranks what is ARCHIVAL. A pending
   request can still be cancelled, still shows live expiry, and may be mid-copy
   — it earns a full card. A resolved one is a receipt: it is read at a glance,
   never acted on, and there can be many. Giving both the same card was the
   thing that made the page read as eight identical blocks.

   So: cards for pending, a dense single-line row per resolved transfer, under a
   quiet section header. The tight/generous contrast is what creates the rhythm;
   the resolved rows also drop out of the list a day after resolution (server
   side), so this section stays short. */
function SentList({
  rows,
  busyId,
  onCancel,
  onViewContents,
}: {
  rows: SentRow[];
  busyId: string | null;
  onCancel: (row: SentRow) => void;
  onViewContents: (row: SentRow) => void;
}) {
  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <SectionHeading label="În așteptare" count={pending.length} />
          <ul className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {pending.map((row, i) => (
                <SentPendingCard
                  key={row.id}
                  row={row}
                  index={i}
                  busy={busyId === row.id}
                  onCancel={() => onCancel(row)}
                  onViewContents={() => onViewContents(row)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <SectionHeading label="Rezolvate recent" count={resolved.length} />
          <ul className="overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-900/20 divide-y divide-zinc-800/50">
            <AnimatePresence initial={false}>
              {resolved.map((row) => (
                <SentResolvedRow key={row.id} row={row} />
              ))}
            </AnimatePresence>
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            Transferurile rezolvate dispar din listă după o zi.
          </p>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 text-sm font-medium text-zinc-400">
      {label}
      <span className="rounded-full bg-zinc-800/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-400">
        {count}
      </span>
    </h2>
  );
}

// Full card: still cancellable, still expiring, possibly mid-copy.
function SentPendingCard({
  row,
  index,
  busy,
  onCancel,
  onViewContents,
}: {
  row: SentRow;
  index: number;
  busy: boolean;
  onCancel: () => void;
  onViewContents: () => void;
}) {
  const inProgress = row.progressTotal != null;
  return (
    <TransferCard
      index={index}
      title={transferTitle(row.itemNames, row.folderCount, row.fileCount)}
      counterpartPrefix="către"
      counterpartUsername={row.recipientUsername}
      mode={row.mode}
      folderCount={row.folderCount}
      fileCount={row.fileCount}
      firstName={row.itemNames[0]}
      expiryText={row.expiryText}
      urgent={isUrgent(row.expiresAt)}
      itemLabel={row.itemLabel}
      progress={inProgress ? { done: row.progressDone, total: row.progressTotal } : null}
      actions={
        inProgress ? null : (
          <>
            <ViewContentsButton onClick={onViewContents} />
            <Button variant="unstyled"
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Anulează"}
            </Button>
          </>
        )
      }
    />
  );
}

// Receipt row: one line, scannable down the left edge, no card chrome. The
// status colour lives in the icon so the row reads at a glance without a badge
// competing with the recipient's name.
function SentResolvedRow({ row }: { row: SentRow }) {
  const { icon: Icon, className } = STATUS_META[row.status];
  return (
    <motion.li
      layout
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-zinc-900/40"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${className}`}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="truncate text-sm font-medium leading-6 text-zinc-100">
          {transferTitle(row.itemNames, row.folderCount, row.fileCount)}
        </span>
        <span className="truncate text-[13px] leading-5 text-zinc-400">
          către {row.recipientUsername}
        </span>
      </div>

      <span className="hidden shrink-0 items-center gap-1 text-[13px] text-zinc-400 sm:flex">
        {row.mode === "copy" ? (
          <CopyIcon className="h-3.5 w-3.5" />
        ) : (
          <ArrowRightLeft className="h-3.5 w-3.5" />
        )}
        {row.mode === "copy" ? "Copie" : "Mutare"}
      </span>

      {/* Status is named in text, never colour-only. */}
      <span className="shrink-0 text-[13px] font-medium text-zinc-300">
        {TRANSFER_STATUS_LABEL[row.status]}
      </span>

      {row.resolvedAt && (
        <time
          dateTime={row.resolvedAt}
          className="hidden shrink-0 text-[13px] tabular-nums text-zinc-400 sm:block"
        >
          {formatDateShort(row.resolvedAt)}
        </time>
      )}
    </motion.li>
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
      <p className="text-sm text-zinc-400">{text}</p>
    </div>
  );
}
