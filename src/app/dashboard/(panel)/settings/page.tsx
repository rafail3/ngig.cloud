import { Suspense } from "react";
import { connection } from "next/server";
import { getSettings } from "@/server/admin/settings";
import { listNotificationTypes, ADDABLE_ACTIONS } from "@/server/notifications/catalog";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { NotificationSettings } from "@/components/dashboard/NotificationTypesList";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Setări" };

// Settings stream behind <Suspense> while the page heading paints instantly.
// connection() marks this as request-time only: getSettings uses the admin
// client (env secrets, no cookies), which Next would otherwise try to run
// during the static prerender at build — where those secrets don't exist.
async function SettingsContent() {
  await connection();
  const settings = await getSettings();
  return <SettingsForm settings={settings} />;
}

async function NotificationsContent() {
  await connection();
  const types = await listNotificationTypes();
  return <NotificationSettings types={types} addable={ADDABLE_ACTIONS} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Setări</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Setări generale ale platformei. Limitele per-user le suprascriu pe cele globale.
          </p>
        </header>

        <Suspense fallback={<ListSkeleton rows={3} />}>
          <SettingsContent />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-lg font-semibold text-zinc-100">Setări notificări</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Activează sau dezactivează tipurile de notificări trimise pentru fiecare acțiune din
            platformă. Tipurile noi apar aici automat pe măsură ce sunt adăugate.
          </p>
        </header>

        <Suspense fallback={<ListSkeleton rows={4} />}>
          <NotificationsContent />
        </Suspense>
      </section>
    </div>
  );
}
