"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import {
  revokeInviteAction,
  deleteInviteAction,
} from "@/app/dashboard/(panel)/invites/actions";
import {
  inviteStatus,
  INVITE_STATUS_LABEL,
  type InviteStatus,
} from "@/lib/invite-status";
import type { InviteRow } from "@/server/invites/service";
import { formatDateTime as fmt } from "@/lib/format-date";

const STATUS_BADGE: Record<InviteStatus, string> = {
  active: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  used: "border-sky-800/60 bg-sky-950/40 text-sky-300",
  expired: "border-amber-800/60 bg-amber-950/40 text-amber-300",
  revoked: "border-red-900/60 bg-red-950/40 text-red-300",
};

// A used (or revoked) code can no longer be redeemed → show it as no longer
// valid in the expiry column, regardless of its original expiry time.
function ExpiryCell({ inv }: { inv: InviteRow }) {
  if (inv.used_at || inv.revoked_at) {
    return <span className="text-amber-400/90">Expirat</span>;
  }
  if (!inv.expires_at) return <span className="text-zinc-400">Niciodată</span>;
  return <span className="text-zinc-400">{fmt(inv.expires_at)}</span>;
}

function CodeCell({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copiază"
      className="group flex w-full items-center gap-2 text-left font-mono text-xs text-zinc-100 transition hover:text-zinc-50"
    >
      <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{code}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: InviteStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {INVITE_STATUS_LABEL[status]}
    </span>
  );
}

function RevokeButton({ id }: { id: string }) {
  return (
    <form action={revokeInviteAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-amber-900/60 hover:text-amber-300"
      >
        Revocă
      </button>
    </form>
  );
}

function DeleteButton({ id, code, full = false }: { id: string; code: string; full?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Șterge"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 text-xs text-zinc-400 transition hover:border-red-900/60 hover:text-red-300 ${
          full ? "w-full py-2" : "py-1"
        }`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {full && "Șterge"}
      </button>
      {open && <ConfirmDeleteModal id={id} code={code} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConfirmDeleteModal({
  id,
  code,
  onClose,
}: {
  id: string;
  code: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">Ștergi codul?</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Codul{" "}
          <span className="break-all font-mono text-xs text-zinc-300">{code}</span>{" "}
          dispare definitiv din istoric. Acțiunea nu poate fi anulată.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Anulează
          </button>
          <form action={deleteInviteAction}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500"
            >
              Șterge
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function InvitesTable({ invites }: { invites: InviteRow[] }) {
  if (invites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center text-sm text-zinc-500">
        Niciun cod generat încă.
      </div>
    );
  }

  return (
    <div>
      {/* ===== Desktop table ===== */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-800 lg:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-[26%] px-4 py-3 font-medium">Cod</th>
              <th className="w-[9%] px-4 py-3 font-medium">Status</th>
              <th className="w-[8%] px-4 py-3 font-medium">Rol</th>
              <th className="w-[13%] px-4 py-3 font-medium">Creat</th>
              <th className="w-[13%] px-4 py-3 font-medium">Expiră</th>
              <th className="w-[16%] px-4 py-3 font-medium">Folosit de</th>
              <th className="w-[15%] px-4 py-3 font-medium text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {invites.map((inv) => {
              const status = inviteStatus(inv);
              return (
                <tr key={inv.id} className="align-top text-zinc-300">
                  <td className="px-4 py-3">
                    <CodeCell code={inv.code} />
                    {inv.label && (
                      <p className="mt-0.5 break-words text-xs text-zinc-500">{inv.label}</p>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={status} /></td>
                  <td className="px-4 py-3 capitalize">{inv.role}</td>
                  <td className="px-4 py-3 text-zinc-400">{fmt(inv.created_at)}</td>
                  <td className="px-4 py-3"><ExpiryCell inv={inv} /></td>
                  <td className="px-4 py-3">
                    {inv.used_by_username ? (
                      <div className="min-w-0">
                        <p className="truncate text-zinc-200">{inv.used_by_username}</p>
                        <p className="truncate text-xs text-zinc-500">{inv.used_by_email}</p>
                        <p className="mt-0.5 text-xs text-zinc-600">{fmt(inv.used_at)}</p>
                      </div>
                    ) : inv.email ? (
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">Asociat cu</p>
                        <p className="truncate text-zinc-300">{inv.email}</p>
                      </div>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {status === "active" && <RevokeButton id={inv.id} />}
                      <DeleteButton id={inv.id} code={inv.code} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile / tablet cards ===== */}
      <div className="flex flex-col gap-3 lg:hidden">
        {invites.map((inv) => {
          const status = inviteStatus(inv);
          return (
            <div key={inv.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CodeCell code={inv.code} />
                  {inv.label && <p className="mt-1 break-words text-xs text-zinc-500">{inv.label}</p>}
                </div>
                <StatusBadge status={status} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-zinc-500">Rol</dt>
                  <dd className="capitalize text-zinc-300">{inv.role}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Expiră</dt>
                  <dd><ExpiryCell inv={inv} /></dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Creat</dt>
                  <dd className="text-zinc-300">{fmt(inv.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Folosit la</dt>
                  <dd className="text-zinc-300">{fmt(inv.used_at)}</dd>
                </div>
                {inv.used_by_username ? (
                  <div className="col-span-2">
                    <dt className="text-zinc-500">Folosit de</dt>
                    <dd className="break-words text-zinc-300">
                      {inv.used_by_username}{" "}
                      <span className="text-zinc-500">({inv.used_by_email})</span>
                    </dd>
                  </div>
                ) : inv.email ? (
                  <div className="col-span-2">
                    <dt className="text-zinc-500">Email asociat</dt>
                    <dd className="break-words text-zinc-300">{inv.email}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4 flex items-center gap-2">
                {status === "active" && (
                  <div className="flex-1">
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-zinc-800 px-2.5 py-2 text-xs text-zinc-300 transition hover:border-amber-900/60 hover:text-amber-300"
                      >
                        Revocă
                      </button>
                    </form>
                  </div>
                )}
                <div className="flex-1">
                  <DeleteButton id={inv.id} code={inv.code} full />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
