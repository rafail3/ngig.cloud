import type { Metadata } from "next";
import { Suspense } from "react";
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
  Layers,
  Clock,
  CloudOff,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { getSharePage, type SharePageData } from "@/server/share/service";
import { formatBytes } from "@/lib/format";
import { type SharePreviewKind, type ShareLinkKind } from "@/lib/share";
import { ShareThemeToggle } from "@/components/share/ShareThemeToggle";
import { SharePreviewButton } from "@/components/share/SharePreviewButton";
import { ShareFolderTree } from "@/components/share/ShareFolderTree";

export const metadata: Metadata = {
  title: "Fișier partajat",
  // Share links are private capabilities — keep them out of search engines.
  robots: { index: false, follow: false },
};

// The page shell is fully static (no dynamic data) so Cache Components can
// prerender it instantly; the per-token lookup streams inside <Suspense>.
export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-zinc-950 text-zinc-50">
      {/* subtle aurora — kept in its own clipped layer so it never covers or
          clips the header controls (the theme switch lives up there). */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-violet-700/15 blur-[140px]" />
      </div>

      <header className="relative z-30 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <Link
          href="https://ngig.cloud"
          className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <Image
            src="/ngig-mark.png"
            alt="ngig.cloud"
            width={72}
            height={72}
            className="h-9 w-9"
          />
          <span>
            ngig<span className="text-indigo-400">.cloud</span>
          </span>
        </Link>
        <ShareThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <Suspense fallback={<LoadingCard />}>
          <ShareResolved params={params} />
        </Suspense>
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

async function ShareResolved({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getSharePage(token);
  return data ? <ShareCard token={token} data={data} /> : <ExpiredCard />;
}

function ShareCard({ token, data }: { token: string; data: SharePageData }) {
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

        {/* Header: title kicker + name + meta */}
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
              {data.label}
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

        {/* Folder or bundle: browsable contents — enter subfolders, preview
            files in place (nested files/folders included). */}
        {data.tree && (
          <div className="border-t border-zinc-800/80 px-3 py-4 sm:px-4">
            <ShareFolderTree node={data.tree} />
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

// A refined "still valid" pill: a live pulsing dot + the remaining-time label.
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

function LoadingCard() {
  return (
    <div className="flex w-full max-w-xl items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/70 py-20 shadow-2xl backdrop-blur-xl">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </div>
  );
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
