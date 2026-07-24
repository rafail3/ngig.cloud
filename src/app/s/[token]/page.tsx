import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { CloudOff, Loader2 } from "lucide-react";
import { getSharePage } from "@/server/share/service";
import { ShareThemeToggle } from "@/components/share/ShareThemeToggle";
import { ShareContent } from "@/components/share/ShareContent";
import { ShareGate } from "@/components/share/ShareGate";

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
      {/* subtle aurora — its own clipped layer so it never covers the header */}
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
  if (!data) return <ExpiredCard />;
  if (data.locked) return <ShareGate token={token} />;
  return <ShareContent token={token} data={data} />;
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
