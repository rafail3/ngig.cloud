"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Trash2, ChevronDown } from "lucide-react";
import {
  approveRequestAction,
  rejectRequestAction,
  deleteRequestAction,
} from "@/app/dashboard/(panel)/invite-requests/actions";
import type {
  InviteRequestRow,
  InviteRequestStatus,
} from "@/server/invites/service";
import { formatDateTime as fmt } from "@/lib/format-date";

const STATUS_BADGE: Record<InviteRequestStatus, string> = {
  pending: "border-amber-800/60 bg-amber-950/40 text-amber-300",
  approved: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  rejected: "border-zinc-700/60 bg-zinc-900/60 text-zinc-400",
};

const STATUS_LABEL: Record<InviteRequestStatus, string> = {
  pending: "În așteptare",
  approved: "Aprobată",
  rejected: "Respinsă",
};

function StatusBadge({ status }: { status: InviteRequestStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
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
      title="Copiază codul"
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

function Message({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="text-zinc-600">—</span>;
  const long = text.length > 120;
  return (
    <div className="min-w-0">
      <p className={`whitespace-pre-wrap break-words text-zinc-300 ${open ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          {open ? "Mai puțin" : "Mai mult"}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

function ApproveButton({ id, full = false }: { id: string; full?: boolean }) {
  return (
    <form action={approveRequestAction} className={full ? "flex-1" : ""}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title="Generează cod + trimite email"
        className={`rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-700 hover:text-emerald-200 ${
          full ? "w-full py-2" : "py-1"
        }`}
      >
        Aprobă
      </button>
    </form>
  );
}

function RejectButton({ id, full = false }: { id: string; full?: boolean }) {
  return (
    <form action={rejectRequestAction} className={full ? "flex-1" : ""}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={`rounded-lg border border-zinc-800 px-2.5 text-xs text-zinc-300 transition hover:border-amber-900/60 hover:text-amber-300 ${
          full ? "w-full py-2" : "py-1"
        }`}
      >
        Respinge
      </button>
    </form>
  );
}

function DeleteButton({ id, email, full = false }: { id: string; email: string; full?: boolean }) {
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
      {open && <ConfirmDeleteModal id={id} email={email} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConfirmDeleteModal({
  id,
  email,
  onClose,
}: {
  id: string;
  email: string;
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
        <h3 className="mt-4 text-base font-semibold text-zinc-100">Ștergi cererea?</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Cererea de la{" "}
          <span className="break-all text-zinc-300">{email}</span>{" "}
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
          <form action={deleteRequestAction}>
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

function Actions({ req, full = false }: { req: InviteRequestRow; full?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${full ? "" : "justify-end"}`}>
      {req.status === "pending" && (
        <>
          <ApproveButton id={req.id} full={full} />
          <RejectButton id={req.id} full={full} />
        </>
      )}
      {req.status !== "pending" && (
        <div className={full ? "flex-1" : ""}>
          <DeleteButton id={req.id} email={req.email} full={full} />
        </div>
      )}
    </div>
  );
}

export function InviteRequestsTable({ requests }: { requests: InviteRequestRow[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center text-sm text-zinc-500">
        Nicio cerere de invitație încă.
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
              <th className="w-[20%] px-4 py-3 font-medium">Solicitant</th>
              <th className="w-[26%] px-4 py-3 font-medium">Mesaj</th>
              <th className="w-[11%] px-4 py-3 font-medium">Data</th>
              <th className="w-[11%] px-4 py-3 font-medium">Status</th>
              <th className="w-[32%] px-4 py-3 font-medium text-right">Acțiuni / cod</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {requests.map((req) => (
              <tr key={req.id} className="align-top text-zinc-300">
                <td className="px-4 py-3">
                  <p className="truncate font-medium text-zinc-200">{req.name}</p>
                  <p className="truncate text-xs text-zinc-500">{req.email}</p>
                  {req.ip && <p className="mt-0.5 truncate text-xs text-zinc-600">{req.ip}</p>}
                </td>
                <td className="px-4 py-3"><Message text={req.message} /></td>
                <td className="px-4 py-3 text-zinc-400">{fmt(req.created_at)}</td>
                <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                <td className="px-4 py-3">
                  {req.status === "approved" && req.invite_code ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="w-full max-w-[220px]"><CodeCell code={req.invite_code} /></div>
                      <DeleteButton id={req.id} email={req.email} />
                    </div>
                  ) : (
                    <Actions req={req} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile / tablet cards ===== */}
      <div className="flex flex-col gap-3 lg:hidden">
        {requests.map((req) => (
          <div key={req.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-200">{req.name}</p>
                <p className="truncate text-xs text-zinc-500">{req.email}</p>
              </div>
              <StatusBadge status={req.status} />
            </div>

            <div className="mt-3 text-xs">
              <p className="text-zinc-500">Mesaj</p>
              <div className="mt-0.5"><Message text={req.message} /></div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-zinc-500">Data</dt>
                <dd className="text-zinc-300">{fmt(req.created_at)}</dd>
              </div>
              {req.ip && (
                <div>
                  <dt className="text-zinc-500">IP</dt>
                  <dd className="truncate text-zinc-300">{req.ip}</dd>
                </div>
              )}
            </dl>

            {req.status === "approved" && req.invite_code && (
              <div className="mt-3">
                <p className="text-xs text-zinc-500">Cod generat</p>
                <div className="mt-0.5"><CodeCell code={req.invite_code} /></div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Actions req={req} full />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
