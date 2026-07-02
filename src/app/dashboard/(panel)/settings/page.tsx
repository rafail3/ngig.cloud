import { Suspense } from "react";
import { getSettings } from "@/server/admin/settings";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Setări" };

// Settings stream behind <Suspense> while the page heading paints instantly.
async function SettingsContent() {
  const settings = await getSettings();
  return <SettingsForm settings={settings} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Setări</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Setări generale ale platformei. Limitele per-user le suprascriu pe cele globale.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
