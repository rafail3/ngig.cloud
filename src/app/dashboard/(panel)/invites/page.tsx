import { listInvites } from "@/server/invites/service";
import { InviteGenerator } from "@/components/dashboard/InviteGenerator";
import { InvitesTable } from "@/components/dashboard/InvitesTable";

export const metadata = { title: "Dashboard — Invite codes" };
// Always reflect the latest codes (expiry/used state changes over time).
export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const invites = await listInvites();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Invite codes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Generează coduri de invitație și urmărește-le istoricul.
        </p>
      </header>

      <InviteGenerator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Istoric ({invites.length})
        </h2>
        <InvitesTable invites={invites} />
      </section>
    </div>
  );
}
