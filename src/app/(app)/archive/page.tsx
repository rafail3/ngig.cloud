import { listArchive } from "@/server/files/service";
import { ArchiveList } from "@/components/drive/ArchiveList";

export const metadata = { title: "Arhivă" };
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const files = await listArchive();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Arhivă</h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">
        Fișierele arhivate ies din drive ca să faci ordine, dar rămân ale tale,
        intacte și accesibile oricând. Le poți dezarhiva când vrei.
      </p>

      <ArchiveList files={files} />
    </div>
  );
}
