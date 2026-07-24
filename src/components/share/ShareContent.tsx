"use client";

import {
  Download,
  File as FileIcon,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Folder,
  Layers,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { SharePageData, SharePreviewKind, ShareLinkKind } from "@/lib/share";
import { SharePreviewButton } from "./SharePreviewButton";
import { ShareFolderTree } from "./ShareFolderTree";

const KIND_LABEL: Record<ShareLinkKind, string> = {
  file: "Fișier partajat",
  folder: "Folder partajat",
  bundle: "Elemente partajate",
};

// The unlocked share card — shared by the server page (public links) and the
// client unlock flow (password links), so it must be a client component.
export function ShareContent({ token, data }: { token: string; data: SharePageData }) {
  const isBundle = data.kind === "bundle";
  const canPreviewSingle = data.previewUrl != null && data.previewKind != null;
  const downloadLabel =
    data.kind === "file"
      ? "Descarcă"
      : isBundle
        ? "Descarcă tot (.zip)"
        : "Descarcă folderul (.zip)";

  return (
    <div className="w-full max-w-xl">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-50/15 to-transparent" />

        {/* Header */}
        <div className="flex items-start gap-4 p-6 sm:p-7">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300 shadow-inner sm:h-16 sm:w-16">
            <TargetIcon
              kind={data.kind}
              previewKind={data.previewKind}
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400/80">
              {data.label || KIND_LABEL[data.kind]}
            </p>
            <h1 className="mt-1.5 break-words text-lg font-bold leading-tight tracking-tight text-zinc-50 sm:text-xl">
              {data.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {data.size != null && (
                <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/50 px-2.5 py-1 font-medium tabular-nums text-zinc-300">
                  {formatBytes(data.size)}
                </span>
              )}
              <ExpiryPill text={data.expiryText} />
            </div>
          </div>
        </div>

        {/* Folder or bundle: browsable contents */}
        {data.tree && (
          <div className="border-t border-zinc-800/80 px-3 py-4 sm:px-4">
            <ShareFolderTree node={data.tree} token={token} />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5 border-t border-zinc-800/80 p-5 sm:p-6">
          <a
            href={`/s/${token}/download`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <Download className="h-4 w-4" aria-hidden />
            {downloadLabel}
          </a>

          {canPreviewSingle && (
            <SharePreviewButton
              url={data.previewUrl!}
              kind={data.previewKind!}
              name={data.name}
            />
          )}

          <p className="mt-0.5 inline-flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            Descărcare directă, fără cont
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpiryPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1 font-medium text-zinc-300">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <Clock className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
      {text}
    </span>
  );
}

function TargetIcon({
  kind,
  previewKind,
  className,
}: {
  kind: ShareLinkKind;
  previewKind: SharePreviewKind;
  className?: string;
}) {
  if (kind === "bundle") return <Layers className={className} aria-hidden />;
  if (kind === "folder") return <Folder className={className} aria-hidden />;
  if (previewKind === "image") return <ImageIcon className={className} aria-hidden />;
  if (previewKind === "video") return <Film className={className} aria-hidden />;
  if (previewKind === "audio") return <Music className={className} aria-hidden />;
  if (previewKind === "pdf" || previewKind === "text")
    return <FileText className={className} aria-hidden />;
  return <FileIcon className={className} aria-hidden />;
}
