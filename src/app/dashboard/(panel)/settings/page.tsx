import { Suspense } from "react";
import { connection } from "next/server";
import { getSettings } from "@/server/admin/settings";
import { getOfficeStatus } from "@/server/office/config";
import { getOfficeUrlMode } from "@/server/office/onlyoffice";
import { listNotificationTypes, ADDABLE_ACTIONS } from "@/server/notifications/catalog";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { OfficeModeSettings } from "@/components/dashboard/OfficeModeSettings";
import { OfficeServerUrl } from "@/components/dashboard/OfficeServerUrl";
import { OfficeServerStatus } from "@/components/dashboard/OfficeServerStatus";
import { OfficeSettingsCollapsible } from "@/components/dashboard/OfficeSettingsCollapsible";
import { SettingsTabs } from "@/components/dashboard/SettingsTabs";
import { NotificationSettings } from "@/components/dashboard/NotificationTypesList";
import { UpdateNotifySettings } from "@/components/dashboard/UpdateNotifySettings";
import { getUpdateNotifySettings } from "@/server/updates/service";
import { viewerIsSuperAdmin } from "@/server/admin/guard";
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

async function OfficeContent() {
  await connection();
  const [status, urlMode] = await Promise.all([getOfficeStatus(), getOfficeUrlMode()]);
  return (
    <OfficeSettingsCollapsible up={status.up} dsUrl={status.dsUrl} configured={status.configured}>
      <OfficeServerUrl url={status.dsUrl} mode={urlMode} />
      <OfficeModeSettings status={status} />
    </OfficeSettingsCollapsible>
  );
}

async function NotificationsContent() {
  await connection();
  const [types, updateNotify] = await Promise.all([
    listNotificationTypes(),
    getUpdateNotifySettings(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <UpdateNotifySettings settings={updateNotify} />
      <NotificationSettings types={types} addable={ADDABLE_ACTIONS} />
    </div>
  );
}

function GeneralTab() {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Setări generale</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Limitele de storage și de conturi ale platformei. Limitele per-user le suprascriu pe cele globale.
        </p>
      </header>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SettingsContent />
      </Suspense>
    </section>
  );
}

function ServersTab() {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">OnlyOffice Docker Server</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Containerul Docker care generează previzualizările fidele și editarea documentelor
          Word, Excel și PowerPoint — starea lui în timp real și cum îl folosește platforma.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <OfficeContent />
      </Suspense>

      {/* Self-fetching, live — no server data to await. */}
      <OfficeServerStatus />
    </section>
  );
}

function NotificationsTab() {
  return (
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
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Setări</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configurarea platformei, pe secțiuni.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton rows={4} />}>
        <SettingsGate />
      </Suspense>
    </div>
  );
}

// The whole settings surface is super-admin only (nav hides it from managers;
// this gate covers direct URLs).
async function SettingsGate() {
  await connection();
  if (!(await viewerIsSuperAdmin())) {
    return (
      <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
        Setările platformei sunt gestionate doar de super admin.
      </div>
    );
  }
  return (
    <SettingsTabs
      general={<GeneralTab />}
      servers={<ServersTab />}
      notifications={<NotificationsTab />}
    />
  );
}
