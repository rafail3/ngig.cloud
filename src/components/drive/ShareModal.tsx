"use client";

import { useState } from "react";
import {
  Share2,
  Link2,
  Send,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "./anim";
import { createShareLinkAction } from "@/app/drive-actions";
import {
  EXPIRY_PRESETS,
  DEFAULT_EXPIRY,
  presetToExpiry,
  expiryLabel,
  type ExpiryPreset,
  type ShareTargetType,
} from "@/lib/share";

type Target = { type: ShareTargetType; id: string; name: string };
type Generated = { absoluteUrl: string; expiryText: string };

// The "Partajează" dialog: generate a public, expiring link to one file/folder.
// Structured with two tabs so Faza B (user-to-user transfer) slots in without a
// redesign — that tab is present but disabled for now.
export function ShareModal({
  target,
  onClose,
}: {
  target: Target;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<ExpiryPreset>(DEFAULT_EXPIRY);
  const [customOn, setCustomOn] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    // Compute expiry inside the handler (never during render — a clock read
    // there is impure). The server revalidates this against its own clock.
    let expiresAt: string | null;
    if (customOn) {
      if (!customValue) {
        toast.error("Alege o dată de expirare.");
        return;
      }
      const t = new Date(customValue).getTime();
      if (Number.isNaN(t) || t <= Date.now()) {
        toast.error("Data trebuie să fie în viitor.");
        return;
      }
      expiresAt = new Date(t).toISOString();
    } else {
      expiresAt = presetToExpiry(preset, Date.now());
    }

    setBusy(true);
    const res = await createShareLinkAction({
      targetType: target.type,
      targetId: target.id,
      expiresAt,
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
    setGenerated({
      absoluteUrl: `${window.location.origin}${res.url}`,
      expiryText: expiryLabel(res.expiresAt, Date.now()),
    });
  }

  async function copy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.absoluteUrl);
      setCopied(true);
      toast.success("Link copiat.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nu am putut copia. Copiază manual.");
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 text-indigo-400">
          <Share2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-100">Partajează</h3>
          <p className="truncate text-xs text-zinc-500">{target.name}</p>
        </div>
      </div>

      {/* Tabs — "Trimite utilizator" arrives in Faza B */}
      <div className="mt-4 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1">
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100">
          <Link2 className="h-4 w-4" />
          Link public
        </span>
        <span
          className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-600"
          title="Disponibil în curând"
        >
          <Send className="h-4 w-4" />
          Trimite utilizator
        </span>
      </div>

      {generated ? (
        <GeneratedView
          generated={generated}
          copied={copied}
          onCopy={copy}
          onReset={() => {
            setGenerated(null);
            setCopied(false);
          }}
        />
      ) : (
        <>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Expiră după
            </p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {EXPIRY_PRESETS.map((p) => {
                const active = !customOn && preset === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setCustomOn(false);
                      setPreset(p.value);
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-300"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCustomOn((v) => !v)}
              className={`mt-2 text-xs font-medium transition-colors ${
                customOn ? "text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {customOn ? "− Ascunde data personalizată" : "+ Dată personalizată"}
            </button>

            {customOn && (
              <input
                type="datetime-local"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40 [color-scheme:dark]"
              />
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {busy ? "Se generează…" : "Generează link"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function GeneratedView({
  generated,
  copied,
  onCopy,
  onReset,
}: {
  generated: Generated;
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={generated.absoluteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-sm text-zinc-200 outline-none"
        />
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copiază linkul"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? "Copiat" : "Copiază"}</span>
        </button>
      </div>

      <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-zinc-500">
        <Clock className="h-3.5 w-3.5" />
        {generated.expiryText}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Alt link
        </button>
        <a
          href={generated.absoluteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          <ExternalLink className="h-4 w-4" />
          Deschide
        </a>
      </div>
    </div>
  );
}
