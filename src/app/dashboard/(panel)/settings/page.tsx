import { getSettings } from "@/server/admin/settings";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export const metadata = { title: "Dashboard — Setări" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Setări</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Setări generale ale platformei. Limitele per-user le suprascriu pe cele globale.
        </p>
      </header>

      <SettingsForm settings={settings} />
    </div>
  );
}
