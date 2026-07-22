import { Suspense } from "react";
import { connection } from "next/server";
import { listInviteRequests } from "@/server/invites/service";
import { viewerIsSuperAdmin } from "@/server/admin/guard";
import { InviteRequestsTable } from "@/components/dashboard/InviteRequestsTable";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Cereri invitații" };

async function RequestsContent() {
  await connection();
  const [requests, isSuper] = await Promise.all([listInviteRequests(), viewerIsSuperAdmin()]);
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-zinc-400">
        Cereri ({requests.length}
        {pending > 0 ? ` · ${pending} în așteptare` : ""})
      </h2>
      <InviteRequestsTable requests={requests} canDelete={isSuper} />
    </section>
  );
}

export default function InviteRequestsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Cereri de invitație</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cererile trimise din formularul public. Aprobă (generează cod + trimite email) sau respinge.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <RequestsContent />
      </Suspense>
    </div>
  );
}
