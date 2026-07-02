import { Suspense } from "react";
import { listInvites } from "@/server/invites/service";
import { InviteGenerator } from "@/components/dashboard/InviteGenerator";
import { InvitesTable } from "@/components/dashboard/InvitesTable";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Invite codes" };

// Reads the (dynamic) email search param and the uncached invite history, so it
// streams behind <Suspense> while the page heading paints instantly.
async function InvitesContent({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const invites = await listInvites();

  return (
    <>
      <InviteGenerator prefillEmail={email} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Istoric ({invites.length})
        </h2>
        <InvitesTable invites={invites} />
      </section>
    </>
  );
}

export default function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Invite codes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Generează coduri de invitație și urmărește-le istoricul.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <InvitesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
