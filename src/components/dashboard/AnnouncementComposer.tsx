"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Megaphone, Send, X } from "lucide-react";
import {
  sendAnnouncementAction,
  type AnnouncementState,
} from "@/app/dashboard/(panel)/announcements/actions";

const initial: AnnouncementState = {};

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-indigo-500/60 focus:outline-none";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400";

export function AnnouncementComposer() {
  const [state, action, pending] = useActionState(sendAnnouncementAction, initial);
  const [confirm, setConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form fields after a successful send (DOM reset only — no state
  // update here, which the React compiler lint forbids in an effect). The
  // confirm dialog is closed from the confirm button's own click handler.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const v = state.values;

  // Validate the required fields client-side before opening the confirm dialog.
  function openConfirm() {
    const f = formRef.current;
    if (!f) return;
    const title = (f.elements.namedItem("title") as HTMLInputElement)?.value.trim();
    const body = (f.elements.namedItem("body") as HTMLTextAreaElement)?.value.trim();
    if (!title || !body) {
      setLocalError("Completează titlul și mesajul.");
      return;
    }
    setLocalError(null);
    setConfirm(true);
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
          <Megaphone className="h-4 w-4" />
        </span>
        Anunț nou
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <label htmlFor="ann-title" className={labelCls}>
            Titlu
          </label>
          <input
            id="ann-title"
            name="title"
            type="text"
            defaultValue={v?.title}
            maxLength={120}
            placeholder="ex: Mentenanță programată"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ann-body" className={labelCls}>
            Mesaj
          </label>
          <textarea
            id="ann-body"
            name="body"
            rows={4}
            defaultValue={v?.body}
            maxLength={2000}
            placeholder="Scrie anunțul pe care îl vor primi toți utilizatorii…"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="ann-link" className={labelCls}>
            Link <span className="text-zinc-600">(opțional)</span>
          </label>
          <input
            id="ann-link"
            name="link"
            type="text"
            defaultValue={v?.link}
            placeholder="/profil sau https://…"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Cale internă (ex: <span className="text-zinc-400">/trash</span>) sau URL extern — cel
            extern se deschide în tab nou.
          </p>
        </div>
      </div>

      {(state.error || localError) && (
        <p className="mt-4 text-sm text-red-400">{state.error ?? localError}</p>
      )}
      {state.ok && <p className="mt-4 text-sm text-emerald-400">{state.ok}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={openConfirm}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Trimite anunțul
        </button>
      </div>

      {confirm && (
        <ConfirmSend pending={pending} onClose={() => setConfirm(false)} />
      )}
    </form>
  );
}

// Confirmation before broadcasting to everyone. The confirm button is a real
// submit inside the form, so it sends with the composed field values.
function ConfirmSend({
  pending,
  onClose,
}: {
  pending: boolean;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/10">
          <Megaphone className="h-5 w-5 text-indigo-300" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">Trimiți anunțul?</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Anunțul ajunge la <span className="text-zinc-200">toți utilizatorii</span> ca notificare.
          Îl poți retrage ulterior din istoric.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            <X className="h-4 w-4" />
            Anulează
          </button>
          <button
            type="submit"
            disabled={pending}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {pending ? "Se trimite…" : "Trimite"}
          </button>
        </div>
      </div>
    </div>
  );
}
