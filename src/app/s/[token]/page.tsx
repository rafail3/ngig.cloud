import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Download,
  File as FileIcon,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Folder,
  Clock,
  CloudOff,
  ShieldCheck,
} from "lucide-react";
import { getSharePage, type SharePageData } from "@/server/share/service";
import { formatBytes } from "@/lib/format";
import { type SharePreviewKind } from "@/lib/share";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "Fișier partajat",
  // Share links are private capabilities — keep them out of search engines.
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getSharePage(token);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      {/* subtle aurora — brand accent, works in both themes */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-indigo-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-violet-700/15 blur-[140px]" />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <Link
          href="https://ngig.cloud"
          className="group flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Image
            src="/ngig-mark.png"
            alt="ngig.cloud"
            width={64}
            height={64}
            className="h-7 w-7"
          />
          <span>
            ngig<span className="text-indigo-400">.cloud</span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        {data ? (
          <ShareCard token={token} data={data} />
        ) : (
          <ExpiredCard />
        )}
      </main>

      <footer className="relative z-10 px-4 pb-6 text-center text-xs text-zinc-500">
        Distribuit în siguranță prin{" "}
        <Link href="https://ngig.cloud" className="text-zinc-400 hover:text-zinc-300">
          ngig.cloud
        </Link>
      </footer>
    </div>
  );
}

function ShareCard({ token, data }: { token: string; data: SharePageData }) {
  const isFolder = data.targetType === "folder";

  return (
    <div className="w-full max-w-2xl">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-50/15 to-transparent" />

        {/* Header row: icon + name + meta */}
        <div className="flex items-start gap-4 p-5 sm:p-7">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 text-indigo-400 shadow-inner sm:h-16 sm:w-16">
            <TargetIcon
              isFolder={isFolder}
              previewKind={data.previewKind}
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {isFolder ? "Folder partajat" : "Fișier partajat"}
            </p>
            <h1 className="mt-1 break-words text-lg font-semibold leading-snug text-zinc-50 sm:text-xl">
              {data.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
              {data.size != null && (
                <span className="tabular-nums">{formatBytes(data.size)}</span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {data.expiryText}
              </span>
            </div>
          </div>
        </div>

        {/* Preview (when the type is renderable) */}
        {data.previewUrl && data.previewKind && (
          <div className="border-t border-zinc-800 bg-zinc-950/40 p-3 sm:p-4">
            <SharePreview
              kind={data.previewKind}
              url={data.previewUrl}
              name={data.name}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t border-zinc-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            Descărcare directă, fără cont
          </p>
          <a
            href={`/s/${token}/download`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <Download className="h-4 w-4" aria-hidden />
            {isFolder ? "Descarcă (.zip)" : "Descarcă"}
          </a>
        </div>
      </div>
    </div>
  );
}

function SharePreview({
  kind,
  url,
  name,
}: {
  kind: Exclude<SharePreviewKind, null>;
  url: string;
  name: string;
}) {
  const frame = "overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950";

  if (kind === "image") {
    return (
      <div className={`${frame} flex items-center justify-center`}>
        {/* Presigned B2 URL of an unknown remote object — a plain <img> avoids
            next/image's optimizer + host allow-list entirely. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="max-h-[65vh] w-auto max-w-full object-contain"
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className={frame}>
        <video src={url} controls className="max-h-[65vh] w-full" />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  // pdf + text render in a sandboxed frame (the browser's own viewer).
  return (
    <iframe
      src={url}
      title={name}
      sandbox=""
      className={`${frame} h-[70vh] w-full`}
    />
  );
}

function TargetIcon({
  isFolder,
  previewKind,
  className,
}: {
  isFolder: boolean;
  previewKind: SharePreviewKind;
  className?: string;
}) {
  if (isFolder) return <Folder className={className} aria-hidden />;
  if (previewKind === "image") return <ImageIcon className={className} aria-hidden />;
  if (previewKind === "video") return <Film className={className} aria-hidden />;
  if (previewKind === "audio") return <Music className={className} aria-hidden />;
  if (previewKind === "pdf" || previewKind === "text")
    return <FileText className={className} aria-hidden />;
  return <FileIcon className={className} aria-hidden />;
}

function ExpiredCard() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 text-zinc-500">
          <CloudOff className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-zinc-50">Link indisponibil</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-400">
          Linkul a expirat, a fost revocat sau nu există. Cere-i persoanei care
          l-a distribuit un link nou.
        </p>
        <Link
          href="https://ngig.cloud"
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
        >
          Mergi la ngig.cloud
        </Link>
      </div>
    </div>
  );
}
