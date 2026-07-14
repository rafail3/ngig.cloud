"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Send, X, Clock } from "lucide-react";
import {
  sendAnnouncementAction,
  type AnnouncementState,
} from "@/app/dashboard/(panel)/announcements/actions";
import { DateTimePicker } from "./DateTimePicker";
import { RichTextEditor } from "./RichTextEditor";

const initial: AnnouncementState = {};

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-indigo-500/60 focus:outline-none";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400";

type Mode = "now" | "schedule";

function formatLocal(value: string): string {
  return new Date(value).toLocaleString("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AnnouncementComposer() {
  const [state, action, pending] = useActionState(sendAnnouncementAction, initial);
  const [mode, setMode] = useState<Mode>("now");
  const [bodyHtml, setBodyHtml] = useState("");
  const [scheduledValue, setScheduledValue] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [scheduleLabel, setScheduleLabel] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form fields after a successful send (DOM reset only — no state
  // update here, which the React compiler lint forbids in an effect). The
  // confirm dialog is closed from the confirm button's own click handler.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  // Surface every server result as a toast (a new state object arrives per
  // submission, so this fires once each time).
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.ok);
  }, [state]);

  const v = state.values;

  // Validate required fields (+ the schedule time) before opening the confirm.
  function openConfirm() {
    const f = formRef.current;
    if (!f) return;
    const title = (f.elements.namedItem("title") as HTMLInputElement)?.value.trim();
    const bodyText = bodyHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!title || !bodyText) {
      toast.error("Completează titlul și mesajul.");
      return;
    }
    if (mode === "schedule") {
      if (!scheduledValue) {
        toast.error("Alege data și ora pentru programare.");
        return;
      }
      const when = new Date(scheduledValue);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        toast.error("Alege un moment din viitor.");
        return;
      }
      setScheduleLabel(formatLocal(scheduledValue));
    } else {
      setScheduleLabel(null);
    }
    setConfirm(true);
  }

  // Fill the hidden ISO field (converting the local picker value), submit the
  // form synchronously, then close the dialog. Clearing the picker afterwards is
  // safe — requestSubmit captured the FormData before this runs.
  function submitForm() {
    const f = formRef.current;
    if (!f) return;
    const iso = f.elements.namedItem("scheduledAt") as HTMLInputElement;
    iso.value =
      mode === "schedule" && scheduledValue
        ? new Date(scheduledValue).toISOString()
        : "";
    f.requestSubmit();
    setConfirm(false);
    setScheduledValue("");
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6"
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
          <span className={labelCls}>Mesaj</span>
          <RichTextEditor
            key={state.nonce ?? 0}
            initialHtml=""
            onChange={setBodyHtml}
            placeholder="Scrie anunțul pe care îl vor primi toți utilizatorii…"
          />
          <input type="hidden" name="body" value={bodyHtml} readOnly />
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

        {/* Delivery timing */}
        <div>
          <span className={labelCls}>Livrare</span>
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode("now")}
              className={`rounded-md px-3 py-1.5 transition ${
                mode === "now"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Trimite acum
            </button>
            <button
              type="button"
              onClick={() => setMode("schedule")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                mode === "schedule"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Programează
            </button>
          </div>

          {mode === "schedule" && (
            <div className="mt-3">
              <DateTimePicker value={scheduledValue} onChange={setScheduledValue} />
              <p className="mt-1 text-xs text-zinc-500">
                Se trimite automat la ora aleasă (fus orar România), chiar dacă nu ești pe
                platformă.
              </p>
            </div>
          )}
        </div>

        {/* Carries the ISO instant computed from the local picker at submit. */}
        <input type="hidden" name="scheduledAt" />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={openConfirm}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === "schedule" ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {mode === "schedule" ? "Programează anunțul" : "Trimite anunțul"}
        </button>
      </div>

      {confirm && (
        <ConfirmSend
          pending={pending}
          scheduleLabel={scheduleLabel}
          onConfirm={submitForm}
          onClose={() => setConfirm(false)}
        />
      )}
    </form>
  );
}

// Confirmation before broadcasting. The confirm button submits the parent form
// programmatically (see submitForm), so it can close the dialog safely.
function ConfirmSend({
  pending,
  scheduleLabel,
  onConfirm,
  onClose,
}: {
  pending: boolean;
  scheduleLabel: string | null;
  onConfirm: () => void;
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

  const scheduled = scheduleLabel != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/10">
          {scheduled ? (
            <Clock className="h-5 w-5 text-indigo-300" />
          ) : (
            <Megaphone className="h-5 w-5 text-indigo-300" />
          )}
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">
          {scheduled ? "Programezi anunțul?" : "Trimiți anunțul?"}
        </h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          {scheduled ? (
            <>
              Se trimite automat la <span className="text-zinc-200">{scheduleLabel}</span> către
              toți utilizatorii. Îl poți anula până atunci din istoric.
            </>
          ) : (
            <>
              Anunțul ajunge la <span className="text-zinc-200">toți utilizatorii</span> ca
              notificare. Îl poți retrage ulterior din istoric.
            </>
          )}
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
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {scheduled ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {scheduled ? "Programează" : "Trimite"}
          </button>
        </div>
      </div>
    </div>
  );
}
