import { ArchiveBoard } from "@/components/drive/ArchiveBoard";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata = { title: "Arhivă" };

export default function ArchivePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Arhivă"
        description="Fișierele arhivate ies din drive ca să faci ordine, dar rămân ale tale, intacte și accesibile oricând. Le poți dezarhiva când vrei."
      />

      <ArchiveBoard />
    </div>
  );
}
