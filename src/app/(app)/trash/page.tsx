import { TRASH_RETENTION_DAYS } from "@/server/files/service";
import { TrashBoard } from "@/components/drive/TrashBoard";

export const metadata = { title: "Coș" };

export default function TrashPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Coș</h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">
        Fișierele șterse rămân aici {TRASH_RETENTION_DAYS} de zile, apoi se șterg
        automat. Le poți restaura sau șterge definitiv oricând.
      </p>

      <TrashBoard />
    </div>
  );
}
