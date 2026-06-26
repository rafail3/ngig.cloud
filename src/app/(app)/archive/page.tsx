import { Suspense } from "react";
import { listArchive } from "@/server/files/service";
import { ArchiveList } from "@/components/drive/ArchiveList";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Arhivă" };
export const unstable_instant = { prefetch: "static" };

// The archived-files query is per-user (uncached), so it streams behind a
// <Suspense> boundary while the page heading paints instantly.
async function ArchiveContent() {
  const files = await listArchive();
  return <ArchiveList files={files} />;
}

export default function ArchivePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Arhivă</h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">
        Fișierele arhivate ies din drive ca să faci ordine, dar rămân ale tale,
        intacte și accesibile oricând. Le poți dezarhiva când vrei.
      </p>

      <Suspense fallback={<ListSkeleton />}>
        <ArchiveContent />
      </Suspense>
    </div>
  );
}
