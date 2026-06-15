import { listUsers } from "@/server/admin/users";
import { UsersTable } from "@/components/dashboard/UsersTable";

export const metadata = { title: "Dashboard — Useri" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Useri</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Toți userii platformei — activitate, spațiu, locație și acțiuni.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Total ({users.length})
        </h2>
        <UsersTable users={users} />
      </section>
    </div>
  );
}
