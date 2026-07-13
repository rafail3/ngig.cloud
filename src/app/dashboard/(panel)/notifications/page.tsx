import { Suspense } from "react";
import { connection } from "next/server";
import { listNotificationTypes } from "@/server/notifications/catalog";
import { NotificationTypesList } from "@/components/dashboard/NotificationTypesList";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Notificări" };

async function Content() {
  await connection();
  const types = await listNotificationTypes();
  return <NotificationTypesList types={types} />;
}

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Notificări</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Activează sau dezactivează tipurile de notificări trimise pentru fiecare acțiune din
          platformă. Tipurile noi apar aici automat pe măsură ce sunt adăugate.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}
