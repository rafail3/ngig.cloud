"use client";

import { useEffect, useState } from "react";
import {
  Link2,
  File as FileIcon,
  Folder,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Eye,
  Lock,
  Hash,
  Bell,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { listMySharesAction, revokeShareAction } from "@/app/drive-actions";
import { expiryLabel, type MyShareLinkView } from "@/lib/share";
import { formatDateShort } from "@/lib/format-date";

type Row = MyShareLinkView & { expiryText: string; absoluteUrl: string };

// "Linkurile mele" — every active public link the user owns, with copy, open
// and revoke. Expired links never appear (the service filters them out).
export function SharedLinksBoard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function load() {
    const res = await listMySharesAction();
    if (!Array.isArray(res)) {
      window.location.assign("/login");
      return;
    }
    // Compute display labels here (in an effect, not during render — a clock
    // read in render is impure).
    const now = Date.now();
    setRows(
      res.map((r) => ({
        ...r,
        expiryText: expiryLabel(r.expiresAt, now),
        absoluteUrl: `${window.location.origin}${r.url}`,
      })),
    );
  }

  useEffect(() => {
    // Fetch-on-mount; setRows runs only after the await resolves (not a
    // synchronous cascading render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function copy(row: Row) {
    try {
      await navigator.clipboard.writeText(row.absoluteUrl);
      setCopiedId(row.id);
      toast.success("Link copiat.");
      window.setTimeout(
        () => setCopiedId((id) => (id === row.id ? null : id)),
        2000,
      );
    } catch {
      toast.error("Nu am putut copia. Copiază manual.");
    }
  }

  async function revoke(row: Row) {
    setRevoking(row.id);
    const res = await revokeShareAction(row.id);
    setRevoking(null);
    if (res && "revoked" in res) {
      window.location.assign("/login");
      return;
    }
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
    toast.success("Link revocat.");
  }

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
          <Link2 className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium text-zinc-300">Niciun link activ</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
          Partajează un fișier sau folder din drive („Partajează”) ca să
          generezi un link public care apare aici.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {rows.length} {rows.length === 1 ? "link activ" : "linkuri active"}
      </p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/60"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300"
              >
                {row.kind === "bundle" ? (
                  <Layers className="h-5 w-5" />
                ) : row.kind === "folder" ? (
                  <Folder className="h-5 w-5" />
                ) : (
                  <FileIcon className="h-5 w-5" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {row.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                    {row.expiryText}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-400"
                    title="Accesări"
                  >
                    <Eye className="h-3 w-3" aria-hidden />
                    <span className="tabular-nums">{row.accessCount}</span>
                  </span>
                  {row.hasPassword && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                      title="Protejat cu parolă"
                    >
                      <Lock className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                  {row.maxDownloads !== null && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-400"
                      title="Descărcări folosite / limită"
                    >
                      <Hash className="h-3 w-3" aria-hidden />
                      <span className="tabular-nums">
                        {row.downloadCount}/{row.maxDownloads}
                      </span>
                    </span>
                  )}
                  {row.notifyOnAccess && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] font-medium text-zinc-400"
                      title="Notificare la accesare activă"
                    >
                      <Bell className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                  <span className="hidden text-[11px] text-zinc-600 sm:inline">
                    Creat {formatDateShort(row.createdAt)}
                  </span>
                </div>
              </div>

              {/* Revoke lives apart from the safe actions */}
              <button
                type="button"
                onClick={() => revoke(row)}
                disabled={revoking === row.id}
                aria-label="Revocă linkul"
                title="Revocă"
                className="shrink-0 rounded-lg border border-zinc-800 p-2 text-zinc-500 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
              >
                {revoking === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Link + copy/open */}
            <div className="mt-3 flex items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-xs text-zinc-400">
                {row.absoluteUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(row)}
                aria-label="Copiază linkul"
                title="Copiază"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-400"
              >
                {copiedId === row.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {copiedId === row.id ? "Copiat" : "Copiază"}
                </span>
              </button>
              <a
                href={row.absoluteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Deschide linkul"
                title="Deschide"
                className="shrink-0 rounded-lg border border-zinc-800 p-2 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
