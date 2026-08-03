"use client";

import { useState } from "react";
import {
  Send,
  Copy as CopyIcon,
  ArrowRightLeft,
  Loader2,
  CheckCircle2,
  Folder,
  File as FileIcon,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createTransferAction } from "@/app/(app)/transfers/actions";
import { UserSearchInput } from "./UserSearchInput";
import { FilePickerModal, type PickedTarget } from "./FilePickerModal";
import type { UserSearchResult, TransferMode } from "@/lib/transfer";
import type { ShareTargetType } from "@/lib/share";

type Target = { type: ShareTargetType; id: string };

// The single send-a-transfer flow, used from all three entry points:
//  - the share modal's "Trimite" tab   → targets given, recipients empty
//  - a user's public profile           → targets null, recipient prefilled
//  - the /transfers page               → targets null, recipients empty
//
// `targets = null` means "the files aren't chosen yet" and turns on an extra
// Fișiere section backed by FilePickerModal. Keeping ONE component means the
// validation, the copy/move rule and the send path can't drift between entry
// points.
export function SendTransferPanel({
  targets,
  initialRecipients = [],
  onClose,
}: {
  targets: Target[] | null;
  initialRecipients?: UserSearchResult[];
  onClose: () => void;
}) {
  const [recipients, setRecipients] = useState<UserSearchResult[]>(initialRecipients);
  const [mode, setMode] = useState<TransferMode>("copy");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [picked, setPicked] = useState<PickedTarget[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Either the caller supplied the targets, or the user picked them here.
  const effectiveTargets: Target[] =
    targets ?? picked.map((p) => ({ type: p.type, id: p.id }));

  const multiple = recipients.length > 1;
  // Move only makes sense with exactly one destination — derived so a stale
  // "move" preference never reaches the server with 2+ recipients, but is
  // restored automatically the moment the user drops back down to one.
  const effectiveMode: TransferMode = multiple ? "copy" : mode;

  function addRecipient(u: UserSearchResult) {
    setRecipients((prev) => [...prev, u]);
  }
  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function send() {
    if (effectiveTargets.length === 0) {
      toast.error("Alege ce vrei să trimiți.");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Alege cel puțin un destinatar.");
      return;
    }
    setBusy(true);
    const res = await createTransferAction({
      targets: effectiveTargets,
      recipientIds: recipients.map((r) => r.id),
      mode: effectiveMode,
    });
    setBusy(false);
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    const names = recipients.map((r) => r.username);
    const summary =
      names.length === 1
        ? names[0]
        : names.length === 2
          ? `${names[0]} și ${names[1]}`
          : `${names.slice(0, -1).join(", ")} și ${names[names.length - 1]}`;
    return (
      <div className="mt-5 flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-zinc-100">
          {names.length === 1 ? "Cerere trimisă către " : "Cereri trimise către "}
          {summary}
        </p>
        <p className="max-w-xs text-xs text-zinc-500">
          {names.length === 1
            ? `${names[0]} trebuie să accepte cererea înainte ca fișierele să ajungă la el.`
            : "Fiecare trebuie să accepte cererea înainte ca fișierele să ajungă la el."}{" "}
          Vezi statusul în „Transferuri”.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          Închide
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="space-y-4">
        {targets === null && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Fișiere
            </p>
            {picked.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <span
                    key={`${p.type}:${p.id}`}
                    className="flex max-w-full items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/40 py-1 pl-2.5 pr-1.5 text-xs font-medium text-zinc-300"
                  >
                    {p.type === "folder" ? (
                      <Folder className="h-3 w-3 shrink-0 text-indigo-400" aria-hidden />
                    ) : (
                      <FileIcon className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
                    )}
                    <span className="truncate">{p.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPicked((prev) =>
                          prev.filter((x) => !(x.type === p.type && x.id === p.id)),
                        )
                      }
                      aria-label={`Scoate ${p.name}`}
                      className="rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/[0.06] hover:text-indigo-300"
            >
              <Plus className="h-4 w-4" />
              {picked.length > 0 ? "Modifică selecția" : "Alege fișiere sau foldere"}
            </button>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Destinatari
          </p>
          <UserSearchInput selected={recipients} onAdd={addRecipient} onRemove={removeRecipient} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Mod
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("copy")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                mode === "copy"
                  ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-950/40"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <CopyIcon className="h-4 w-4" />
              Copie
            </button>
            <button
              type="button"
              onClick={() => !multiple && setMode("move")}
              disabled={multiple}
              title={multiple ? "Mutarea definitivă e permisă doar către un singur destinatar." : undefined}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "move" && !multiple
                  ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-950/40"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Mută definitiv
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {multiple
              ? "Mutarea definitivă e permisă doar către un singur destinatar — cu mai mulți, se trimite o copie fiecăruia."
              : mode === "copy"
                ? "Rămâi cu originalul; destinatarul primește o copie."
                : "La acceptare, elementele dispar din contul tău și trec definitiv la destinatar."}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          Anulează
        </button>
        <button
          type="button"
          onClick={send}
          disabled={busy || recipients.length === 0 || effectiveTargets.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Se trimite…" : "Trimite"}
        </button>
      </div>

      {pickerOpen && (
        <FilePickerModal
          initial={picked}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(next) => {
            setPicked(next);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
