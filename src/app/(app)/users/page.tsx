import { Suspense } from "react";
import { UsersDirectory } from "@/components/users/UsersDirectory";
import { PageHeader } from "@/components/common/PageHeader";

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Utilizatori"
        description="Ceilalți membri ai cloudului. Deschide un profil ca să-i trimiți fișiere sau foldere direct."
      />

      <Suspense fallback={null}>
        <UsersDirectory initialQuery={q ?? ""} />
      </Suspense>
    </div>
  );
}
