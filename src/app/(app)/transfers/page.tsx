import { TransfersBoard } from "@/components/transfer/TransfersBoard";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata = { title: "Transferuri" };

export default function TransfersPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Transferuri"
        description="Fișiere și foldere trimise direct altor utilizatori. O cerere trebuie acceptată sau refuzată de destinatar înainte să ajungă în drive-ul lui."
      />

      <TransfersBoard />
    </div>
  );
}
