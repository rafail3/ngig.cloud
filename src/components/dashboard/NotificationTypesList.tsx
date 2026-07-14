"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
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

// Render text with {placeholder} tokens highlighted (known vars = indigo chip,
// unknown = muted), for the overlay behind the message textarea.
function renderTokens(text: string, vars: string[]): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const known = vars.includes(m[1]);
    parts.push(
      <span
        key={i++}
        className={
          known
            ? "rounded bg-indigo-500/20 font-medium text-indigo-300"
            : "text-zinc-500"
        }
      >
        {m[0]}
      </span>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Computed-style keys mirrored to measure the caret's pixel position.
const MIRROR_KEYS = [
  "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "wordSpacing", "tabSize",
] as const;

// Pixel (left, top) of the caret at `pos` within an input/textarea, relative to
// the field's border box. Uses a hidden mirror div (the standard technique).
function caretCoords(el: HTMLTextAreaElement | HTMLInputElement, pos: number): { left: number; top: number } {
  const div = document.createElement("div");
  const s = getComputedStyle(el);
  const target = div.style as unknown as Record<string, string>;
  const source = s as unknown as Record<string, string>;
  for (const k of MIRROR_KEYS) target[k] = source[k];
  const multiline = el.tagName === "TEXTAREA";
  div.style.position = "absolute";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.visibility = "hidden";
  div.style.overflow = "hidden";
  div.style.whiteSpace = multiline ? "pre-wrap" : "pre";
  div.style.wordWrap = multiline ? "break-word" : "normal";
  div.style.width = `${el.clientWidth}px`;
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = el.value.slice(pos) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const left = span.offsetLeft - el.scrollLeft;
  const top = span.offsetTop - el.scrollTop;
  document.body.removeChild(div);
  return { left, top };
}

// Highlighted, variable-aware field (single-line input or multiline textarea):
// {tokens} are highlighted via an aligned overlay, and typing "{" (or the start
// of a var name) pops an inline autocomplete right at the caret.
function TemplateField({
  id,
  value,
  onChange,
  vars,
  multiline,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  vars: string[];
  multiline: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [sugg, setSugg] = useState<{ start: number; left: number; top: number } | null>(null);
  const [matches, setMatches] = useState<string[]>([]);
  const box = "px-3.5 py-2 text-sm leading-6";

  function refresh() {
    const el = ref.current;
    if (!el) return;
    const val = el.value;
    const cursor = el.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const open = before.lastIndexOf("{");
    if (open === -1) return setSugg(null);
    const between = before.slice(open + 1);
    if (/[}\s]/.test(between)) return setSugg(null);
    const hits = vars.filter((v) => v.startsWith(between));
    if (hits.length === 0) return setSugg(null);
    const c = caretCoords(el, cursor);
    setMatches(hits);
    setSugg({ start: open, left: c.left, top: c.top });
  }

  function insert(name: string) {
    const el = ref.current;
    if (!el || !sugg) return;
    const cursor = el.selectionStart ?? value.length;
    const next = value.slice(0, sugg.start) + `{${name}}` + value.slice(cursor);
    onChange(next);
    setSugg(null);
    const pos = sugg.start + name.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  const overlayCls = `pointer-events-none absolute inset-0 overflow-hidden text-zinc-100 ${box} ${
    multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre"
  }`;
  const fieldCls = `relative z-10 block w-full bg-transparent text-transparent caret-zinc-100 outline-none selection:bg-indigo-500/30 ${box} ${
    multiline ? "resize-none" : ""
  }`;
  const common = {
    id,
    ref,
    value,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value);
      requestAnimationFrame(refresh);
    },
    onClick: refresh,
    onKeyUp: refresh,
    onBlur: () => setTimeout(() => setSugg(null), 150),
    className: fieldCls,
  };

  return (
    <div className="relative rounded-lg border border-zinc-800 bg-zinc-950 focus-within:border-indigo-500/60">
      <div
        ref={overlayRef}
        aria-hidden
        className={overlayCls}
        style={multiline ? undefined : { whiteSpace: "pre" }}
      >
        {renderTokens(value, vars)}
        {multiline && "\n"}
      </div>
      {multiline ? (
        <textarea
          {...common}
          rows={3}
          maxLength={1000}
          onScroll={(e) => {
            if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
        />
      ) : (
        <input
          {...common}
          type="text"
          maxLength={200}
          onScroll={(e) => {
            if (overlayRef.current) overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
        />
      )}
      {sugg && matches.length > 0 && (
        <div
          className="absolute z-20 flex flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl"
          style={{ left: sugg.left, top: sugg.top + 22 }}
        >
          {matches.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insert(v);
              }}
              className="rounded-md px-2 py-1 text-left font-mono text-xs text-indigo-300 transition hover:bg-zinc-800"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditModal({ t, onClose }: { t: NotificationTypeStatus; onClose: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const [pending, start] = useTransition();

  // Dirty vs the currently-saved message → drives the Save button + close guard.
  const dirty = title !== t.title || body !== t.body;

  // Guarded close: blocks (with a warning) when there are unsaved edits.
  function attemptClose() {
    if (dirty) {
      toast.error("Ai modificări nesalvate. Salvează, sau apasă Anulează pentru a renunța.");
      return;
    }
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  function save() {
    const tt = title.trim();
    const bb = body.trim();
    if (!tt || !bb) {
      toast.error("Titlul și mesajul nu pot fi goale.");
      return;
    }
    start(async () => {
      // Saving the defaults back = revert (no custom override, no badge).
      if (tt === t.defaultTitle && bb === t.defaultBody) {
        await resetNotificationTemplateAction(t.key);
      } else {
        const res = await setNotificationTemplateAction(t.key, title, body);
        if (res.error) {
          toast.error(res.error);
          return;
        }
      }
      toast.success("Mesajul notificării a fost salvat.");
      onClose();
    });
  }

  // Just fill the fields with the defaults — nothing is saved until "Salvează".
  function toDefault() {
    setTitle(t.defaultTitle);
    setBody(t.defaultBody);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={attemptClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Editează mesajul</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{t.label}</p>
          </div>
          <button
            type="button"
            onClick={attemptClose}
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
            <TemplateField id="nt-title" value={title} onChange={setTitle} vars={t.vars} multiline={false} />
          </div>
          <div>
            <label htmlFor="nt-body" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Mesaj
            </label>
            <TemplateField id="nt-body" value={body} onChange={setBody} vars={t.vars} multiline />
          </div>

          {t.vars.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-400">
                Valori dinamice — scrie <span className="text-zinc-300">{"{"}</span> în titlu sau
                mesaj ca să le sugereze, sau apasă una:
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
            onClick={toDefault}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
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
              disabled={pending || !dirty}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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
