import { Suspense } from "react";
import { connection } from "next/server";
import { listAnnouncements } from "@/server/announcements/service";
import { viewerIsSuperAdmin } from "@/server/admin/guard";
import { AnnouncementComposer } from "@/components/dashboard/AnnouncementComposer";
import { AnnouncementHistory } from "@/components/dashboard/AnnouncementHistory";
import { SectionGate } from "@/components/dashboard/SectionGate";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Anunțuri" };

async function HistoryContent() {
  await connection();
  const [items, isSuper] = await Promise.all([listAnnouncements(), viewerIsSuperAdmin()]);
  return <AnnouncementHistory items={items} canDelete={isSuper} />;
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

      {/* The composer is gated too, so the whole page body sits behind one
          gate — the header still paints instantly. */}
      <Suspense fallback={<ListSkeleton />}>
        <SectionGate section="announcements">
          <AnnouncementComposer />

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-400">Istoric</h2>
            <Suspense fallback={<ListSkeleton />}>
              <HistoryContent />
            </Suspense>
          </section>
        </SectionGate>
      </Suspense>
    </div>
  );
}
