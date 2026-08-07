import { UploadsBoard } from "@/components/drive/UploadsBoard";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata = { title: "Încărcări" };

export default function UploadsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Încărcări"
        description="Fișierele care se încarcă acum, cu viteză, timp rămas și progres pentru fiecare. Încărcările continuă și dacă reîncarci pagina."
      />

      <UploadsBoard />
    </div>
  );
}
