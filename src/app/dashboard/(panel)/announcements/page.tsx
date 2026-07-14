import { Suspense } from "react";
import { connection } from "next/server";
import { listAnnouncements } from "@/server/announcements/service";
import { AnnouncementComposer } from "@/components/dashboard/AnnouncementComposer";
import { AnnouncementHistory } from "@/components/dashboard/AnnouncementHistory";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Anunțuri" };

async function HistoryContent() {
  await connection();
  const items = await listAnnouncements();
  return <AnnouncementHistory items={items} />;
}

export default function AnnouncementsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Anunțuri</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Trimite un anunț către toți utilizatorii. Apare instant în clopoțelul lor de notificări.
        </p>
      </header>

      <AnnouncementComposer />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Istoric</h2>
        <Suspense fallback={<ListSkeleton />}>
          <HistoryContent />
        </Suspense>
      </section>
    </div>
  );
}
