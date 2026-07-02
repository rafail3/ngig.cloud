import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/server/admin/users";
import { UserDetailBody } from "@/components/dashboard/UserDetailBody";
import { UserDetailSkeleton } from "@/components/dashboard/UserDetailSkeleton";

// `id` (dynamic param), the user lookup and the self-check are all per-request,
// so they resolve inside <Suspense> while the back-link header paints instantly.
async function UserDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSelf = (data?.claims?.sub as string | undefined) === id;

  return <UserDetailBody user={user} isSelf={isSelf} />;
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Înapoi la useri
        </Link>
      </div>
      <Suspense fallback={<UserDetailSkeleton />}>
        <UserDetailContent params={params} />
      </Suspense>
    </div>
  );
}
