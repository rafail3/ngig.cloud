"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2, Users, ExternalLink, Link2, RefreshCw, Clock } from "lucide-react";
import {
  deleteAnnouncementAction,
  resendAnnouncementAction,
} from "@/app/dashboard/(panel)/announcements/actions";
import type { AnnouncementRow } from "@/server/announcements/service";
import { formatDateTime as fmt } from "@/lib/format-date";

function ScheduledBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-800/60 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300">
      <Clock className="h-3 w-3" />
      Programat
    </span>
  );
}

function LinkChip({ link }: { link: string }) {
  const external = /^https?:\/\//i.test(link);
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-indigo-300">
      {external ? (
        <ExternalLink className="h-3 w-3 shrink-0" />
      ) : (
        <Link2 className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{link}</span>
    </span>
  );
}

function ResendButton({ id, title, full = false }: { id: string; title: string; full?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Retrimite"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 text-xs text-zinc-400 transition hover:border-indigo-500/60 hover:text-indigo-300 ${
          full ? "w-full py-2" : "py-1"
        }`}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {full && "Retrimite"}
      </button>
      {open && <ConfirmResend id={id} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConfirmResend({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  function doResend() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await resendAnnouncementAction(fd);
      onClose();
    });
  }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/10">
          <RefreshCw className="h-5 w-5 text-indigo-300" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">Retrimiți anunțul?</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          „<span className="text-zinc-300">{title}</span>” va fi trimis din nou tuturor
          utilizatorilor, ca un anunț nou.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={doResend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Se retrimite…" : "Retrimite"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteButton({
  id,
  title,
  scheduled = false,
  full = false,
}: {
  id: string;
  title: string;
  scheduled?: boolean;
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={scheduled ? "Anulează programarea" : "Șterge și retrage"}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 text-xs text-zinc-400 transition hover:border-red-900/60 hover:text-red-300 ${
          full ? "w-full py-2" : "py-1"
        }`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {full && (scheduled ? "Anulează" : "Șterge")}
      </button>
      {open && (
        <ConfirmDelete
          id={id}
          title={title}
          scheduled={scheduled}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConfirmDelete({
  id,
  title,
  scheduled,
  onClose,
}: {
  id: string;
  title: string;
  scheduled: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  function doDelete() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteAnnouncementAction(fd);
      onClose();
    });
  }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">
          {scheduled ? "Anulezi programarea?" : "Ștergi anunțul?"}
        </h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          {scheduled ? (
            <>
              „<span className="text-zinc-300">{title}</span>” nu va mai fi trimis. Acțiunea nu
              poate fi anulată.
            </>
          ) : (
            <>
              „<span className="text-zinc-300">{title}</span>” dispare din istoric și e{" "}
              <span className="text-zinc-300">retras din notificările tuturor utilizatorilor</span>
              . Acțiunea nu poate fi anulată.
            </>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={doDelete}
            disabled={pending}
            className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-60"
          >
            {pending ? "Se șterge…" : scheduled ? "Anulează programarea" : "Șterge"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnnouncementHistory({ items }: { items: AnnouncementRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center text-sm text-zinc-500">
        Niciun anunț trimis încă.
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
              <th className="w-[46%] px-4 py-3 font-medium">Anunț</th>
              <th className="w-[16%] px-4 py-3 font-medium">Destinatari</th>
              <th className="w-[22%] px-4 py-3 font-medium">Trimis</th>
              <th className="w-[16%] px-4 py-3 font-medium text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {items.map((a) => (
              <tr key={a.id} className="align-top text-zinc-300">
                <td className="px-4 py-3">
                  <p className="truncate text-[15px] font-semibold text-zinc-100">{a.title}</p>
                  <p
                    className="mt-0.5 line-clamp-2 break-words text-sm text-zinc-300 [&_a]:text-indigo-400 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: a.body }}
                  />
                  {a.link && (
                    <div className="mt-1.5">
                      <LinkChip link={a.link} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.sent_at ? (
                    <span className="inline-flex items-center gap-1.5 text-zinc-300">
                      <Users className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="tabular-nums">{a.recipient_count}</span>
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {a.sent_at ? (
                    fmt(a.sent_at)
                  ) : (
                    <span className="flex flex-col items-start gap-1">
                      <ScheduledBadge />
                      <span className="whitespace-nowrap text-xs text-zinc-500">
                        pentru {fmt(a.scheduled_at)}
                      </span>
                    </span>
                  )}
                  {a.created_by_username && (
                    <span className="mt-0.5 block truncate text-xs text-zinc-600">
                      de {a.created_by_username}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {a.sent_at && <ResendButton id={a.id} title={a.title} />}
                    <DeleteButton id={a.id} title={a.title} scheduled={!a.sent_at} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile / tablet cards ===== */}
      <div className="flex flex-col gap-3 lg:hidden">
        {items.map((a) => (
          <div key={a.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[15px] font-semibold text-zinc-100">{a.title}</p>
            <p
              className="mt-1 break-words text-sm text-zinc-300 [&_a]:text-indigo-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: a.body }}
            />
            {a.link && (
              <div className="mt-2">
                <LinkChip link={a.link} />
              </div>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-zinc-500">Destinatari</dt>
                <dd className="tabular-nums text-zinc-300">
                  {a.sent_at ? a.recipient_count : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">{a.sent_at ? "Trimis" : "Programat"}</dt>
                <dd className="text-zinc-300">
                  {a.sent_at ? fmt(a.sent_at) : fmt(a.scheduled_at)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              {a.sent_at && <ResendButton id={a.id} title={a.title} full />}
              <DeleteButton id={a.id} title={a.title} scheduled={!a.sent_at} full />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
