"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { User, Shield, Plus, BellOff, Pencil, X, RotateCcw } from "lucide-react";
import {
  setNotificationEnabledAction,
  setNotificationTemplateAction,
  resetNotificationTemplateAction,
} from "@/app/dashboard/(panel)/notifications/actions";
import type {
  NotificationAudience,
  NotificationTypeMeta,
  NotificationTypeStatus,
} from "@/server/notifications/catalog";

const AUDIENCE: Record<
  NotificationAudience,
  { label: string; icon: React.ReactNode; cls: string }
> = {
  user: {
    label: "Utilizator",
    icon: <User className="h-3 w-3" />,
    cls: "border-sky-800/60 bg-sky-950/40 text-sky-300",
  },
  admin: {
    label: "Admin",
    icon: <Shield className="h-3 w-3" />,
    cls: "border-violet-800/60 bg-violet-950/40 text-violet-300",
  },
};

const SECTIONS: { key: NotificationAudience; label: string }[] = [
  { key: "user", label: "Pentru utilizatori" },
  { key: "admin", label: "Pentru administratori" },
];

function AudienceBadge({ audience }: { audience: NotificationAudience }) {
  const a = AUDIENCE[audience];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${a.cls}`}
    >
      {a.icon}
      {a.label}
    </span>
  );
}

function Toggle({
  enabled,
  onFlip,
  pending,
}: {
  enabled: boolean;
  onFlip: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onFlip}
      disabled={pending}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
        enabled ? "bg-indigo-600" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function EditModal({ t, onClose }: { t: NotificationTypeStatus; onClose: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function save() {
    start(async () => {
      const res = await setNotificationTemplateAction(t.key, title, body);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Mesajul notificării a fost salvat.");
      onClose();
    });
  }

  function reset() {
    start(async () => {
      await resetNotificationTemplateAction(t.key);
      toast.success("Mesajul a fost readus la varianta implicită.");
      onClose();
    });
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-indigo-500/60 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Editează mesajul</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{t.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="nt-title" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Titlu
            </label>
            <input
              id="nt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="nt-body" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Mesaj
            </label>
            <textarea
              id="nt-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={1000}
              className={`${inputCls} resize-y`}
            />
          </div>

          {t.vars.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-400">
                Valori dinamice — folosește-le în titlu sau mesaj și se completează automat:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.vars.map((v) => (
                  <code
                    key={v}
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-indigo-300"
                  >
                    {`{${v}}`}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending || !t.customized}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Implicit
          </button>
          <div className="flex gap-2">
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
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {pending ? "Se salvează…" : "Salvează"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ t }: { t: NotificationTypeStatus }) {
  const [on, setOn] = useState(t.enabled);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function flip() {
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        await setNotificationEnabledAction(t.key, next);
        toast.success(next ? `„${t.label}" activată.` : `„${t.label}" dezactivată.`);
      } catch {
        setOn(!next);
        toast.error("Nu am putut salva. Reîncearcă.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-900 px-4 py-3.5 last:border-b-0 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-zinc-100">{t.label}</p>
          {t.customized && (
            <span className="rounded-full border border-indigo-800/60 bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
              Personalizat
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editează mesajul"
        title="Editează mesajul"
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <div className="hidden w-20 shrink-0 sm:flex sm:justify-end">
        <AudienceBadge audience={t.audience} />
      </div>
      <Toggle enabled={on} onFlip={flip} pending={pending} />
      {editing && <EditModal t={t} onClose={() => setEditing(false)} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
        active ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function ExistingTab({ types }: { types: NotificationTypeStatus[] }) {
  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map(({ key, label }) => {
        const group = types.filter((t) => t.audience === key);
        if (group.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
              {group.map((t) => (
                <Row key={t.key} t={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AddTab({ addable }: { addable: NotificationTypeMeta[] }) {
  const [selected, setSelected] = useState("");

  if (addable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <BellOff className="h-5 w-5 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-400">
          Momentan nu există acțiuni noi pentru care să adaugi o notificare.
        </p>
        <p className="max-w-sm text-xs text-zinc-500">
          Pe măsură ce apar acțiuni noi în platformă, ele vor apărea automat aici, gata de adăugat.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <label htmlFor="add-action" className="mb-1.5 block text-xs font-medium text-zinc-400">
        Acțiune
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          id="add-action"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-indigo-500/60 focus:outline-none"
        >
          <option value="">Alege o acțiune…</option>
          {addable.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selected}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Adaugă
        </button>
      </div>
    </div>
  );
}

export function NotificationSettings({
  types,
  addable,
}: {
  types: NotificationTypeStatus[];
  addable: NotificationTypeMeta[];
}) {
  const [tab, setTab] = useState<"existing" | "add">("existing");

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/40 p-0.5">
        <TabButton active={tab === "existing"} onClick={() => setTab("existing")}>
          Notificări existente
        </TabButton>
        <TabButton active={tab === "add"} onClick={() => setTab("add")}>
          Adaugă notificare
        </TabButton>
      </div>

      {tab === "existing" ? <ExistingTab types={types} /> : <AddTab addable={addable} />}
    </div>
  );
}
