import { Suspense } from "react";
import { connection } from "next/server";
import { listUsers } from "@/server/admin/users";
import { UsersTable } from "@/components/dashboard/UsersTable";
import { SectionGate } from "@/components/dashboard/SectionGate";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Useri" };

// The user list is uncached admin data, so it streams behind <Suspense> while
// the page heading paints instantly.
async function UsersContent() {
  await connection();
  const users = await listUsers();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-zinc-400">
        Total <span className="tabular-nums text-zinc-500">({users.length})</span>
      </h2>
      <UsersTable users={users} />
    </section>
  );
}

export default function UsersPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Useri</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Toți userii platformei — activitate, spațiu, locație și acțiuni.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <SectionGate section="users">
          <UsersContent />
        </SectionGate>
      </Suspense>
    </div>
  );
}
