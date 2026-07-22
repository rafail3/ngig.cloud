import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getManagerSections } from "@/server/admin/users";
import { UserDetailBody } from "@/components/dashboard/UserDetailBody";
import { UserDetailSkeleton } from "@/components/dashboard/UserDetailSkeleton";
import { SectionGate } from "@/components/dashboard/SectionGate";

// `id` (dynamic param), the user lookup and the self-check are all per-request,
// so they resolve inside <Suspense> while the back-link header paints instantly.
async function UserDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const viewerId = data?.claims?.sub as string | undefined;
  const isSelf = viewerId === id;
  let viewerIsSuper = false;
  if (viewerId) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", viewerId)
      .single();
    viewerIsSuper = viewer?.is_super_admin ?? false;
  }

  // Only the super admin's manager-permissions card needs the current config.
  const managerSections =
    viewerIsSuper && user.role === "admin" && !user.is_super_admin
      ? await getManagerSections(id)
      : null;

  return (
    <UserDetailBody
      user={user}
      isSelf={isSelf}
      viewerIsSuper={viewerIsSuper}
      managerSections={managerSections}
    />
  );
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
        <SectionGate section="users">
          <UserDetailContent params={params} />
        </SectionGate>
      </Suspense>
    </div>
  );
}
