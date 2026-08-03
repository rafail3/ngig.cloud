import { Suspense } from "react";
import { UsersDirectory } from "@/components/users/UsersDirectory";

export const metadata = { title: "Utilizatori" };

// `searchParams` is a promise and UsersDirectory reads useSearchParams — both
// need a Suspense boundary with cacheComponents on (same pattern as the public
// share page).
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Utilizatori</h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">
        Ceilalți membri ai cloudului. Deschide un profil ca să-i trimiți fișiere
        sau foldere direct.
      </p>

      <Suspense fallback={null}>
        <UsersDirectory initialQuery={q ?? ""} />
      </Suspense>
    </div>
  );
}
