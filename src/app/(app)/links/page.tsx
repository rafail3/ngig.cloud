import { SharedLinksBoard } from "@/components/drive/SharedLinksBoard";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata = { title: "Linkuri de partajare" };

export default function LinksPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Linkuri de partajare"
        description="Toate linkurile publice active către fișierele și folderele tale. Oricine are un link îl poate deschide, fără cont, până când expiră sau îl revoci."
      />

      <SharedLinksBoard />
    </div>
  );
}
