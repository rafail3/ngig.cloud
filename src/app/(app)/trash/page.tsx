import { TRASH_RETENTION_DAYS } from "@/server/files/service";
import { TrashBoard } from "@/components/drive/TrashBoard";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata = { title: "Coș" };

export default function TrashPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Coș"
        description={`Fișierele șterse rămân aici ${TRASH_RETENTION_DAYS} de zile, apoi se șterg automat. Le poți restaura sau șterge definitiv oricând.`}
      />

      <TrashBoard />
    </div>
  );
}
